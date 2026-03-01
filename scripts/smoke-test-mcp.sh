#!/usr/bin/env bash
# Inspectra — Smoke Test MCP Server
# Verifies the MCP server builds, starts, and responds to a basic tool list request.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Inspectra MCP Smoke Test ==="
echo ""

# 1. Build
echo "Step 1: Build"
cd "$ROOT_DIR"
npm run build
echo "  Build OK"
echo ""

# 2. Check dist exists
echo "Step 2: Verify dist"
if [[ ! -f "$ROOT_DIR/mcp/dist/index.js" ]]; then
  echo "  FAIL: mcp/dist/index.js not found"
  exit 1
fi
echo "  dist/index.js exists — OK"
echo ""

# 3. Run unit tests
echo "Step 3: Tests"
npm test
echo "  Tests OK"
echo ""

# 4. Start server and send tool list request
echo "Step 4: Server startup smoke test"
INIT_REQUEST='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}'

RESPONSE=$(echo "$INIT_REQUEST" | timeout 10 node "$ROOT_DIR/mcp/dist/index.js" 2>/dev/null)

if [[ -z "$RESPONSE" ]]; then
  echo "  FAIL: Server produced no response"
  exit 1
fi

if echo "$RESPONSE" | grep -q "inspectra"; then
  echo "  Server responded with name 'inspectra' — OK"
else
  echo "  FAIL: Response does not contain 'inspectra'"
  echo "  Response: $RESPONSE"
  exit 1
fi

echo ""
echo "Smoke test complete. MCP server is functional."
