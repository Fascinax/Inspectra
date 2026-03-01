#!/usr/bin/env bash
# Inspectra — Run Local Audit
# Runs a full multi-domain audit locally via the CLI orchestrator.
#
# Usage:
#   ./scripts/run-local-audit.sh <target-project-path> [profile] [format] [output-file]
#
# Examples:
#   ./scripts/run-local-audit.sh ./my-project
#   ./scripts/run-local-audit.sh ./my-project java-backend json
#   ./scripts/run-local-audit.sh ./my-project generic markdown audit-report.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:?Usage: run-local-audit.sh <target-project-path> [profile] [format] [output-file]}"
PROFILE="${2:-generic}"
FORMAT="${3:-markdown}"
OUTPUT="${4:-}"

if [[ ! -d "$TARGET" ]]; then
  echo "ERROR: Target path does not exist: $TARGET"
  exit 1
fi

TARGET=$(cd "$TARGET" && pwd)

# Ensure built
if [[ ! -f "$ROOT_DIR/mcp/dist/cli/audit.js" ]]; then
  echo "CLI not built. Building..."
  cd "$ROOT_DIR"
  npm run build
fi

# Build CLI args
CLI_ARGS="$TARGET --profile=$PROFILE --format=$FORMAT"
if [[ -n "$OUTPUT" ]]; then
  CLI_ARGS="$CLI_ARGS --output=$OUTPUT"
fi

node "$ROOT_DIR/mcp/dist/cli/audit.js" $CLI_ARGS
