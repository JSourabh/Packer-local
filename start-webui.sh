#!/bin/bash
# Start the backend and web UI development servers

echo "Starting Backend API Server..."
cd /home/ubuntu/Packer-local/platform/backend || exit 1
node server.js &
BACKEND_PID=$!

echo "Starting Web UI Frontend..."
cd /home/ubuntu/Packer-local/platform/frontend || exit 1
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Both servers are running!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both servers."

# Wait for any process to exit (or for user to press Ctrl+C)
trap "echo 'Stopping servers...'; kill $BACKEND_PID; kill $FRONTEND_PID; exit 0" SIGINT SIGTERM

wait
