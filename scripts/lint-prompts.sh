#!/usr/bin/env bash
# Inspectra — Lint Prompts
# Validates prompt files and workflow assets.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"


echo "=== Inspectra Prompt Linter ==="
echo ""

PROMPTS_DIR="$ROOT_DIR/.github/prompts"
ERRORS=0

echo "--- Prompt files ---"
if [[ -d "$PROMPTS_DIR" ]]; then
  for f in "$PROMPTS_DIR"/*.prompt.md; do
    if [[ ! -f "$f" ]]; then
      echo "  No prompt files found."
      ERRORS=$((ERRORS + 1))
      break
    fi

    echo -n "  $(basename "$f")... "
    if ! head -1 "$f" | grep -q "^---$"; then
      echo "FAIL (missing YAML frontmatter)"
      ERRORS=$((ERRORS + 1))
      continue
    fi

    echo "OK"
  done
else
  echo "  Prompts directory not found."
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo "All prompt validations passed."
else
  echo "$ERRORS validation(s) failed."
  exit 1
fi
