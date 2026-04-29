#!/bin/sh

# Ensure nginx can run
mkdir -p /run/nginx

# Start the Node.js backend server in the background
# Force it to port 3000 to avoid conflict with Cloud Run's PORT=8080
echo "Starting web-app-server on port 3000..."
cd /app/packages/web-app-server
PORT=3000 node dist/index.js &

# Start Nginx in the foreground on port 8080
echo "Starting Nginx on port 8080..."
nginx -g "daemon off;"
