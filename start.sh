#!/usr/bin/env bash
set -euo pipefail

# Start script used by Railway/Railpack when project root is the repository root.
# It changes into the `project` subfolder, installs dependencies and starts the server.

cd "$(dirname "$0")/project"

if command -v npm >/dev/null 2>&1; then
	echo "Installing npm dependencies..."
	npm install --production
else
	echo "npm not found in PATH — assuming dependencies are already installed or build step handled by platform"
fi

echo "Starting server..."
if command -v node >/dev/null 2>&1; then
	node server.js
else
	echo "node not found in PATH — cannot start server"
	exit 1
fi
