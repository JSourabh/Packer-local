#!/usr/bin/env bash

# ============================================================
# Manage web-platform-binding docker image
# ============================================================

set -euo pipefail

IMAGE_NAME="packer-web-binding"
IMAGE_TAG="latest"
CONTAINER_NAME="packer-web-binding-run"

function usage() {
    echo "Usage: $0 {build|run|stop|clean}"
    echo "  build   : Build the Docker image using Packer"
    echo "  run     : Run the built Docker image locally"
    echo "  stop    : Stop the running container"
    echo "  clean   : Remove the container and the image"
    exit 1
}

if [ $# -eq 0 ]; then
    usage
fi

ACTION=$1

case "$ACTION" in
    build)
        echo "Building $IMAGE_NAME:$IMAGE_TAG using Packer..."
        packer build \
            -var "image_name=$IMAGE_NAME" \
            -var "image_tag=$IMAGE_TAG" \
            -var "build_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            docker-web-binding.pkr.hcl
        ;;
    run)
        echo "Running $IMAGE_NAME:$IMAGE_TAG..."
        docker run -d --name "$CONTAINER_NAME" -p 8080:80 "$IMAGE_NAME:$IMAGE_TAG"
        echo "Container $CONTAINER_NAME is running on http://localhost:8080"
        ;;
    stop)
        echo "Stopping container $CONTAINER_NAME..."
        docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
        docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
        echo "Container stopped and removed."
        ;;
    clean)
        echo "Cleaning up container and image..."
        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
        docker rmi "$IMAGE_NAME:$IMAGE_TAG" >/dev/null 2>&1 || true
        echo "Cleanup complete."
        ;;
    *)
        usage
        ;;
esac
