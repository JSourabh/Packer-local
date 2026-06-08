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

# ============================================================
# VARIABLES
# ============================================================

variable "base_image" {
  type    = string
  default = "ubuntu:22.04"
}

variable "image_name" {
  type    = string
  default = "packer-web-binding"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "build_date" {
  type    = string
  default = ""
}

# ============================================================
# SOURCE
# ============================================================

source "docker" "ubuntu_web_binding" {
  image  = var.base_image
  commit = true
  changes = [
    "EXPOSE 80",
    "ENV DEBIAN_FRONTEND=noninteractive",
    "LABEL maintainer=sysadmin@company.com",
    "LABEL org.opencontainers.image.title=${var.image_name}",
    "LABEL org.opencontainers.image.created=${var.build_date}",
    "CMD [\"/usr/sbin/apache2ctl\", \"-D\", \"FOREGROUND\"]"
  ]
  run_command = ["-d", "-i", "-t", "--entrypoint=/bin/bash", "{{.Image}}"]
}

# ============================================================
# BUILD
# ============================================================

build {
  name    = "packer-web-binding-build"
  sources = ["source.docker.ubuntu_web_binding"]

  # Note: AWS AMI generation has been specifically excluded/disabled from this process.

  # ----------------------------------------------------------
  # STEP 1 — Install Python3 + Ansible INSIDE the container
  # ----------------------------------------------------------
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "apt-get update -qq",
      "apt-get install -y --no-install-recommends python3 python3-pip sudo software-properties-common gnupg curl ca-certificates",
      "ln -sf /usr/bin/python3 /usr/bin/python",
      "pip3 install --break-system-packages ansible 2>/dev/null || pip3 install ansible",
      "ansible --version",
      "echo '>>> Bootstrap complete'"
    ]
  }

  # ----------------------------------------------------------
  # STEP 2 — Copy Ansible playbooks and roles into the container
  #          then run ansible-local
  # ----------------------------------------------------------
  provisioner "ansible-local" {
    playbook_file   = "../../ansible/playbooks/webserver.yml"
    playbook_dir    = "../../ansible"
    staging_directory = "/tmp/packer-ansible"
    clean_staging_directory = true
    extra_arguments = ["--extra-vars", "image_build=true"]
  }

  # ----------------------------------------------------------
  # STEP 3 — ansible-local: security hardening
  # ----------------------------------------------------------
  provisioner "ansible-local" {
    playbook_file   = "../../ansible/playbooks/security.yml"
    playbook_dir    = "../../ansible"
    staging_directory = "/tmp/packer-ansible"
    clean_staging_directory = false
  }

  # STEP 4 — Smoke tests
  provisioner "shell" {
    environment_vars = [
      "DEBIAN_FRONTEND=noninteractive",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    ]
    inline = [
      "echo '=== SMOKE TESTS ==='",
      "/usr/sbin/apache2 -v",
      "python3 --version",
      "pip3 --version",
      "/usr/sbin/apache2ctl configtest",
      "echo '=== ALL SMOKE TESTS PASSED ==='"
    ]
  }
  
  # STEP 5 — Cleanup
  provisioner "shell" {
    environment_vars = [
      "DEBIAN_FRONTEND=noninteractive",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    ]
    inline = [
      "apt-get clean",
      "rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*",
      "rm -rf /root/.cache /root/.ansible"
    ]
  }

  post-processor "docker-tag" {
    repository = var.image_name
    tags       = [var.image_tag]
  }
}
