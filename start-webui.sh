#!/bin/bash
# Start the web UI development server

echo "Starting Web UI..."
cd /home/ubuntu/Packer-local/platform/frontend || exit 1
npm run dev
