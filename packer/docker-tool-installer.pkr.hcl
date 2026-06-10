packer {
  required_version = ">= 1.10.0"
  required_plugins {
    docker = {
      version = ">= 1.0.9"
      source  = "github.com/hashicorp/docker"
    }
    ansible = {
      version = ">= 1.1.2"
      source  = "github.com/hashicorp/ansible"
    }
  }
}

variable "base_image" {
  type    = string
  default = "ubuntu:22.04"
}

variable "image_name" {
  type    = string
  default = "packer-tool-installer"
}

source "docker" "ubuntu_tools" {
  image  = var.base_image
  commit = true
  changes = [
    "ENV DEBIAN_FRONTEND=noninteractive",
    "LABEL maintainer=sysadmin@company.com",
    "LABEL org.opencontainers.image.title=${var.image_name}",
    "CMD [\"/bin/bash\"]"
  ]
  run_command = ["-d", "-i", "-t", "--entrypoint=/bin/bash", "{{.Image}}"]
}

build {
  name    = "packer-tool-installer-build"
  sources = ["source.docker.ubuntu_tools"]

  # Bootstrap python and ansible so ansible-local can run
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "apt-get update -qq",
      "apt-get install -y --no-install-recommends python3 python3-pip sudo",
      "ln -sf /usr/bin/python3 /usr/bin/python",
      "pip3 install --break-system-packages ansible 2>/dev/null || pip3 install ansible"
    ]
  }

  # Run the Ansible playbook to install our tools
  provisioner "ansible-local" {
    playbook_file   = "../ansible/playbooks/install-tool.yml"
    playbook_dir    = "../ansible"
    staging_directory = "/tmp/packer-ansible"
    clean_staging_directory = true
    # Use -vv to ensure verbose output is sent to stdout for the live build logs
    extra_arguments = ["-vv"]
  }

  post-processor "docker-tag" {
    repository = var.image_name
    tags       = ["latest"]
  }
}
