# Inspectra — Makefile
# Unified commands for build, test, validation, and audit.

.PHONY: all install build test clean lint validate smoke audit-local help

# Default
all: install build test

# ─── Core ────────────────────────────────────────────────────────────────────

install: ## Install all dependencies
	npm ci

build: ## Build the MCP server
	npm run build

test: ## Run unit tests
	npm test

clean: ## Clean build artifacts
	npm run clean

dev: ## Watch mode for MCP server
	npm run dev

# ─── Validation ──────────────────────────────────────────────────────────────

validate: validate-schemas lint-agents ## Run all validations

validate-schemas: ## Validate example files against JSON schemas
	bash scripts/validate-schemas.sh

lint-agents: ## Lint agent and prompt files
	bash scripts/lint-agents.sh

smoke: build ## Smoke test the MCP server
	bash scripts/smoke-test-mcp.sh

# ─── Audit ───────────────────────────────────────────────────────────────────

# Usage: make audit-local TARGET=/path/to/project PROFILE=generic FORMAT=markdown OUTPUT=report.md
audit-local: build ## Run a full local audit against a target project
	bash scripts/run-local-audit.sh '$(TARGET)' '$(PROFILE)' '$(FORMAT)' '$(OUTPUT)'

# ─── Setup ───────────────────────────────────────────────────────────────────

bootstrap: ## Full setup: install, build, test
	bash scripts/bootstrap.sh

init: ## Copy agents & config to a target project (TARGET=/path)
	node bin/init.mjs '$(TARGET)'

# ─── Help ────────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
