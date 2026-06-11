const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Path to the packer directory in Packer-local
const PACKER_DIR = path.resolve(__dirname, '../../packer');

// Endpoint to get available templates
app.get('/api/templates', (req, res) => {
  try {
    const files = fs.readdirSync(PACKER_DIR);
    const templates = files.filter(f => f.endsWith('.pkr.hcl') && !f.includes('docker-web-binding'));
    // Return objects for UI
    const result = templates.map(t => ({
      id: t,
      name: t.replace('.pkr.hcl', ''),
      type: t.includes('aws') ? 'AWS' : (t.includes('docker') ? 'Docker' : 'Other')
    }));
    
    // Also check subdirectories for templates if needed, but for now just the root.
    // Specially adding the web-platform-binding one explicitly
    const webBindingDir = path.join(PACKER_DIR, 'web-platform-binding');
    if (fs.existsSync(webBindingDir)) {
      result.push({
        id: 'web-platform-binding/docker-web-binding.pkr.hcl',
        name: 'docker-web-binding',
        type: 'Docker'
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error reading templates:', err);
    res.status(500).json({ error: 'Failed to read templates directory' });
  }
});

// Configure Multer for template uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PACKER_DIR);
  },
  filename: (req, file, cb) => {
    // Keep original filename but ensure it ends with .pkr.hcl
    let filename = file.originalname;
    if (!filename.endsWith('.pkr.hcl')) {
      filename += '.pkr.hcl';
    }
    cb(null, filename);
  }
});
const upload = multer({ storage });

// Endpoint to upload a new template
app.post('/api/templates/upload', upload.single('templateFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ message: 'Template uploaded successfully', filename: req.file.filename });
});

// Endpoint to generate a custom template
app.post('/api/templates/generate', (req, res) => {
  const { platform, imageName, baseAmi, baseImage, instanceType, region, toolName, requirement } = req.body;
  
  if (!imageName) {
    return res.status(400).json({ error: 'Image Name is required' });
  }

  const safeImageName = imageName.replace(/[^a-zA-Z0-9_-]/g, '');
  const prefix = platform === 'docker' ? 'docker-' : 'custom-';
  const filename = `${prefix}${safeImageName}.pkr.hcl`;
  const filePath = path.join(PACKER_DIR, filename);

  let hclContent = '';

  if (platform === 'docker') {
    hclContent = `
packer {
  required_plugins {
    docker = {
      version = ">= 1.0.9"
      source  = "github.com/hashicorp/docker"
    }
  }
}

source "docker" "custom" {
  image  = "${baseImage || 'ubuntu:22.04'}"
  commit = true
}

build {
  sources = ["source.docker.custom"]

  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "apt-get update -qq",
      "apt-get install -y ${toolName} ${requirement}"
    ]
  }

  post-processor "docker-tag" {
    repository = "${safeImageName}"
    tags       = ["latest"]
  }
}
`;
  } else {
    // AWS
    if (!baseAmi || !instanceType || !region) {
      return res.status(400).json({ error: 'Missing required AWS AMI fields' });
    }
    hclContent = `
packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

source "amazon-ebs" "custom" {
  ami_name      = "${safeImageName}-{{timestamp}}"
  instance_type = "${instanceType}"
  region        = "${region}"
  source_ami    = "${baseAmi}"
  ssh_username  = "ubuntu"
}

build {
  sources = ["source.amazon-ebs.custom"]

  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y ${toolName} ${requirement}"
    ]
  }
}
`;
  }

  try {
    fs.writeFileSync(filePath, hclContent.trim());
    res.json({ message: 'Template generated successfully', filename });
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ error: 'Failed to write template file' });
  }
});

// Endpoint to list images
app.get('/api/images', (req, res) => {
  exec('docker images --format "{{.Repository}}:{{.Tag}} ({{.ID}})" | grep packer', (error, stdout, stderr) => {
    if (error && error.code !== 1) { // code 1 means grep found nothing
      return res.status(500).json({ error: stderr || error.message });
    }
    const dockerImages = stdout.trim().split('\n').filter(Boolean);
    
    // AWS AMIs would need aws cli, skipping for simplicity unless requested
    
    res.json({ dockerImages, awsImages: [] });
  });
});

// Build endpoint (SSE for streaming logs)
app.get('/api/build', (req, res) => {
  const template = req.query.template;
  if (!template) {
    return res.status(400).json({ error: 'Template is required' });
  }

  const templatePath = path.join(PACKER_DIR, template);
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ error: 'Template not found' });
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  res.write(`data: Starting build for ${template}...\n\n`);

  const buildProcess = spawn('packer', ['build', template], {
    cwd: path.dirname(templatePath),
    env: { ...process.env, ANSIBLE_FORCE_COLOR: '1' }
  });

  buildProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line) {
        res.write(`data: ${line}\n\n`);
      }
    }
  });

  buildProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line) {
        res.write(`data: ERROR: ${line}\n\n`);
      }
    }
  });

  buildProcess.on('close', (code) => {
    res.write(`data: Build process exited with code ${code}\n\n`);
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
