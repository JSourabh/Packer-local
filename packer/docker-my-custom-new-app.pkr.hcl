packer {
  required_plugins {
    docker = {
      version = ">= 1.0.9"
      source  = "github.com/hashicorp/docker"
    }
  }
}

source "docker" "custom" {
  image  = "ubuntu:24.04"
  commit = true
}

build {
  sources = ["source.docker.custom"]

  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "apt-get update -qq",
      "apt-get install -y nodejs npm"
    ]
  }

  post-processor "docker-tag" {
    repository = "my-custom-new-app"
    tags       = ["latest"]
  }
}