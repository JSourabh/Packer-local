const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

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
    cwd: path.dirname(templatePath)
  });

  buildProcess.stdout.on('data', (data) => {
    res.write(`data: ${data.toString()}\n\n`);
  });

  buildProcess.stderr.on('data', (data) => {
    res.write(`data: ERROR: ${data.toString()}\n\n`);
  });

  buildProcess.on('close', (code) => {
    res.write(`data: Build process exited with code ${code}\n\n`);
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
