# ============================================================
# Packer HCL Template — Docker Web Server Image
# Tools  : Apache, Python 3, pip, Flask
# Provisioner: Ansible
# ============================================================

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
  description = "Base Docker image to use"
  type        = string
  default     = "ubuntu:22.04"
}

variable "image_name" {
  description = "Name of the output Docker image"
  type        = string
  default     = "packer-webserver"
}

variable "image_tag" {
  description = "Tag for the output Docker image"
  type        = string
  default     = "latest"
}

variable "build_date" {
  description = "Build date label injected by CI or manually"
  type        = string
  default     = ""
}

variable "ansible_verbosity" {
  description = "Ansible verbosity flag e.g. -v -vv -vvv"
  type        = string
  default     = ""
}

# ============================================================
# LOCALS — derived values calculated at build time
# ============================================================

locals {
  timestamp = formatdate("YYYYMMDD-HHmmss", timestamp())
  final_tag = var.image_tag != "latest" ? var.image_tag : local.timestamp
}

# ============================================================
# SOURCE BLOCK — Docker builder
# ============================================================

source "docker" "ubuntu_webserver" {
  image  = var.base_image
  commit = true   # commit the finished container as a reusable image

  # OCI labels and runtime defaults baked into the image
  changes = [
    "EXPOSE 80",
    "ENV DEBIAN_FRONTEND=noninteractive",
    "ENV APACHE_LOG_DIR=/var/log/apache2",
    "LABEL maintainer=sysadmin@company.com",
    "LABEL org.opencontainers.image.title=${var.image_name}",
    "LABEL org.opencontainers.image.description=Hardened Apache Python web server",
    "LABEL org.opencontainers.image.created=${var.build_date}",
    "CMD [\"/usr/sbin/apache2ctl\", \"-D\", \"FOREGROUND\"]"
  ]

  # Keep the container running so Ansible can connect
  run_command = ["-d", "-i", "-t", "--entrypoint=/bin/bash", "{{.Image}}"]
}

# ============================================================
# BUILD BLOCK — Provisioners run in order
# ============================================================

build {
  name    = "packer-webserver-build"
  sources = ["source.docker.ubuntu_webserver"]

  # ----------------------------------------------------------
  # STEP 1 — Bootstrap Python so Ansible can talk to the container
  # ----------------------------------------------------------
  provisioner "shell" {
    inline = [
      "apt-get update -qq",
      "apt-get install -y --no-install-recommends python3 python3-pip sudo",
      "ln -sf /usr/bin/python3 /usr/bin/python",
      "echo '>>> Python bootstrap complete'"
    ]
  }

  # STEP 2 — Ansible: install Apache, Python packages, custom config
  provisioner "ansible" {
    playbook_file   = "../ansible/playbooks/webserver.yml"
    user            = "root"
    extra_arguments = compact([
      var.ansible_verbosity,
      "--connection=docker",
      "--extra-vars", "image_build=true"
    ])
    ansible_env_vars = [
      "ANSIBLE_FORCE_COLOR=1",
      "ANSIBLE_HOST_KEY_CHECKING=False",
      "ANSIBLE_ROLES_PATH=../ansible/roles",
      "ANSIBLE_REMOTE_TMP=/tmp/.ansible/tmp",
      "ANSIBLE_LOCAL_TEMP=/tmp/.ansible/local",
      "ANSIBLE_SSH_PIPELINING=True",
      "ANSIBLE_CONFIG=../ansible.cfg",
      "LANG=en_US.UTF-8",
      "LC_ALL=en_US.UTF-8"
    ]
  }

  # STEP 3 — Ansible: security updates and hardening
  provisioner "ansible" {
    playbook_file   = "../ansible/playbooks/security.yml"
    user            = "root"
    extra_arguments = compact([
      var.ansible_verbosity,
      "--connection=docker"
    ])
    ansible_env_vars = [
      "ANSIBLE_FORCE_COLOR=1",
      "ANSIBLE_HOST_KEY_CHECKING=False",
      "ANSIBLE_ROLES_PATH=../ansible/roles",
      "ANSIBLE_REMOTE_TMP=/tmp/.ansible/tmp",
      "ANSIBLE_LOCAL_TEMP=/tmp/.ansible/local",
      "ANSIBLE_SSH_PIPELINING=True",
      "ANSIBLE_CONFIG=../ansible.cfg",
      "LANG=en_US.UTF-8",
      "LC_ALL=en_US.UTF-8"
    ]
  }

  # ----------------------------------------------------------
  # STEP 4 — Smoke tests: verify everything is installed correctly
  # ----------------------------------------------------------
  provisioner "shell" {
    inline = [
      "echo '=== SMOKE TESTS ==='",
      "apache2 -v",
      "python3 --version",
      "pip3 --version",
      "apache2ctl configtest",
      "echo '=== ALL SMOKE TESTS PASSED ==='"
    ]
  }

  # ----------------------------------------------------------
  # STEP 5 — Cleanup: remove apt cache and temp files to slim image
  # ----------------------------------------------------------
  provisioner "shell" {
    inline = [
      "apt-get clean",
      "rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*",
      "rm -rf /root/.cache /root/.ansible",
      "find /var/log -type f -exec truncate --size 0 {} \\;"
    ]
  }

  # ----------------------------------------------------------
  # POST-PROCESSOR — Tag the final image
  # ----------------------------------------------------------
  post-processor "docker-tag" {
    repository = var.image_name
    tags       = [local.final_tag, "latest"]
  }
}
