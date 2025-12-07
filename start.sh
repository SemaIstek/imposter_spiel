#!/usr/bin/env bash
set -euo pipefail

# Start script used by Railway/Railpack when project root is the repository root.
# It changes into the `project` subfolder, installs dependencies and starts the server.

cd "$(dirname "$0")/project"

echo "Installing npm dependencies..."
npm install --production

echo "Starting server..."
npm start
