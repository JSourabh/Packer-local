# Packer Docker Webserver Tutorial

Build a hardened Docker image with Apache, Python 3, Flask,
and security updates using HashiCorp Packer + Ansible.

## Prerequisites (Ubuntu)

```bash
# Docker
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo usermod -aG docker $USER  # log out and back in

# Packer
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update && sudo apt-get install packer
packer version

# Ansible
sudo apt-get install -y ansible
ansible --version
```

## Build the image

```bash
cd ~/packer-tutorial/packer

# 1. Download required Packer plugins
packer init .

# 2. Format check (optional but good habit)
packer fmt -check docker-webserver.pkr.hcl

# 3. Validate the template
packer validate \
  -var "build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  docker-webserver.pkr.hcl

# 4. Build
packer build \
  -var "image_name=packer-webserver" \
  -var "image_tag=v1.0" \
  -var "build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  docker-webserver.pkr.hcl
```

## Verify the image exists

```bash
docker images | grep packer-webserver
```

## Run the image locally

```bash
docker run -d --name packer-web -p 8080:80 packer-webserver:latest
```

## Open in browser
http://localhost:8080



## Run smoke tests

```bash
cd ~/packer-tutorial
./tests/test-image.sh packer-webserver:latest
```

## Inspect the running container

```bash
# Open a shell
docker exec -it packer-web /bin/bash

# Check Python
docker exec packer-web python3 --version

# Check Apache headers
curl -I http://localhost:8080

# View Apache logs
docker exec packer-web cat /var/log/apache2/access.log
```

## Clean up

```bash
docker rm -f packer-web
docker rmi packer-webserver:latest
```

## GitHub Actions (monthly rebuild)

Push this repo to GitHub. The workflow at:
  `.github/workflows/monthly-packer-build.yml`
will automatically rebuild and push the image to GHCR on the
1st of every month. You can also trigger it manually from the
Actions tab in your repository.

