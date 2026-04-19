#!/usr/bin/env bash
# ============================================================
# Local smoke test for the Packer-built Docker image
# Usage: ./tests/test-image.sh [image-name:tag]
# ============================================================
set -euo pipefail

IMAGE_NAME="${1:-packer-webserver:latest}"
CONTAINER_NAME="packer-webserver-test"
TEST_PORT="8080"

echo "=================================================="
echo " Packer Docker Image Smoke Test"
echo " Image: ${IMAGE_NAME}"
echo "=================================================="

# Remove any previous test container
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "[1/6] Starting container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${TEST_PORT}:80" \
  "${IMAGE_NAME}"

echo "[2/6] Waiting for Apache to start..."
sleep 6

echo "[3/6] Testing HTTP response..."
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" http://127.0.0.1:${TEST_PORT})
if [ "${HTTP_STATUS}" != "200" ]; then
  echo "FAIL: Expected HTTP 200, got ${HTTP_STATUS}"
  docker rm -f "${CONTAINER_NAME}"
  exit 1
fi
echo "     HTTP 200 OK"

echo "[4/6] Checking page content..."
curl -fsS http://127.0.0.1:${TEST_PORT} | grep -q "Packer-built" || {
  echo "FAIL: Expected page content not found"
  docker rm -f "${CONTAINER_NAME}"
  exit 1
}
echo "     Page content OK"

echo "[5/6] Checking Python inside container..."
docker exec "${CONTAINER_NAME}" python3 --version

echo "[6/6] Checking Apache config syntax..."
docker exec "${CONTAINER_NAME}" apache2ctl configtest

echo ""
echo "=================================================="
echo " ALL TESTS PASSED"
echo "=================================================="

# Cleanup
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
