#!/usr/bin/env bash
# Inspectra — Bootstrap
# Install all dependencies and build the MCP server.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Inspectra Bootstrap ==="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "none")
if [[ "$NODE_VERSION" == "none" ]]; then
  echo "ERROR: Node.js is not installed. Please install Node.js 20+."
  exit 1
fi

MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [[ "$MAJOR" -lt 20 ]]; then
  echo "ERROR: Node.js $NODE_VERSION detected. Inspectra requires Node.js 20+."
  exit 1
fi
echo "Node.js $NODE_VERSION"

# Install dependencies
echo ""
echo "Installing dependencies..."
cd "$ROOT_DIR"
npm ci

# Build MCP server
echo ""
echo "Building MCP server..."
npm run build

# Run tests
echo ""
echo "Running tests..."
npm test

echo ""
echo "Bootstrap complete. Inspectra is ready."
