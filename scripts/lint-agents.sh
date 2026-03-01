#!/usr/bin/env bash
# Inspectra — Lint Agents
# Validates that all agent files have correct structure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Inspectra Agent Linter ==="
echo ""

AGENTS_DIR="$ROOT_DIR/.github/agents"
PROMPTS_DIR="$ROOT_DIR/.github/prompts"
ERRORS=0

# Check agents directory exists
if [[ ! -d "$AGENTS_DIR" ]]; then
  echo "ERROR: Agents directory not found: $AGENTS_DIR"
  exit 1
fi

# Validate each agent file
echo "--- Agent files ---"
for f in "$AGENTS_DIR"/*.agent.md; do
  if [[ ! -f "$f" ]]; then
    echo "  No agent files found."
    ERRORS=$((ERRORS + 1))
    break
  fi

  name=$(basename "$f")
  echo -n "  $name... "

  # Check YAML frontmatter
  if ! head -1 "$f" | grep -q "^---$"; then
    echo "FAIL (missing YAML frontmatter)"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Check frontmatter has required fields
  frontmatter=$(sed -n '/^---$/,/^---$/p' "$f" | tail -n +2 | head -n -1)

  if ! echo "$frontmatter" | grep -q "^name:"; then
    echo "FAIL (missing 'name' in frontmatter)"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  if ! echo "$frontmatter" | grep -q "^description:"; then
    echo "FAIL (missing 'description' in frontmatter)"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  if ! echo "$frontmatter" | grep -q "^tools:"; then
    echo "FAIL (missing 'tools' in frontmatter)"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  echo "OK"
done

# Validate prompt files
echo ""
echo "--- Prompt files ---"
if [[ -d "$PROMPTS_DIR" ]]; then
  for f in "$PROMPTS_DIR"/*.prompt.md; do
    if [[ ! -f "$f" ]]; then
      echo "  No prompt files found."
      ERRORS=$((ERRORS + 1))
      break
    fi
    echo "  $(basename "$f")... OK"
  done
else
  echo "  Prompts directory not found."
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo "All agent validations passed."
else
  echo "$ERRORS validation(s) failed."
  exit 1
fi
