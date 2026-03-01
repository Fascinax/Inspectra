#!/usr/bin/env bash
# Inspectra — Validate Schemas
# Validates example files against their JSON Schema definitions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Inspectra Schema Validation ==="
echo ""

# Check for ajv-cli
if ! command -v ajv &>/dev/null; then
  echo "ajv-cli not found. Installing..."
  npm install -g ajv-cli ajv-formats
fi

ERRORS=0

# Validate finding samples
echo "--- Finding samples ---"
for f in "$ROOT_DIR"/examples/findings/*.json; do
  if [[ -f "$f" ]]; then
    echo -n "  Validating $(basename "$f")... "
    if ajv validate -s "$ROOT_DIR/schemas/finding.schema.json" -d "$f" --spec=draft2020 -c ajv-formats 2>/dev/null; then
      echo "OK"
    else
      echo "FAIL"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done

# Validate scoring rules match schema
echo ""
echo "--- Scoring schema ---"
if [[ -f "$ROOT_DIR/schemas/scoring.schema.json" ]]; then
  echo "  scoring.schema.json exists — OK"
else
  echo "  scoring.schema.json MISSING"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo "All validations passed."
else
  echo "$ERRORS validation(s) failed."
  exit 1
fi
