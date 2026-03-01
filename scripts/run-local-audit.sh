#!/usr/bin/env bash
# Inspectra — Run Local Audit
# Starts the MCP server locally for testing tools outside of Copilot.
#
# Usage:
#   ./scripts/run-local-audit.sh <target-project-path> [profile]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:?Usage: run-local-audit.sh <target-project-path> [profile]}"
PROFILE="${2:-generic}"

if [[ ! -d "$TARGET" ]]; then
  echo "ERROR: Target path does not exist: $TARGET"
  exit 1
fi

TARGET=$(cd "$TARGET" && pwd)

echo "=== Inspectra Local Audit ==="
echo "Target:  $TARGET"
echo "Profile: $PROFILE"
echo ""

# Ensure built
if [[ ! -f "$ROOT_DIR/mcp/dist/index.js" ]]; then
  echo "MCP server not built. Building..."
  cd "$ROOT_DIR"
  npm run build
fi

# Run individual tools via Node.js and capture results
echo "--- scan-secrets ---"
echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"scan-secrets\",\"arguments\":{\"filePathsCsv\":\"$TARGET\"}}}" | \
  node "$ROOT_DIR/mcp/dist/index.js" 2>/dev/null || echo "(scan-secrets: server exited)"

echo ""
echo "--- check-deps-vulns ---"
echo "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"check-deps-vulns\",\"arguments\":{\"projectDir\":\"$TARGET\"}}}" | \
  node "$ROOT_DIR/mcp/dist/index.js" 2>/dev/null || echo "(check-deps-vulns: server exited)"

echo ""
echo "Local audit complete."
echo "For a full multi-domain audit, use the audit-orchestrator agent in Copilot Chat."
