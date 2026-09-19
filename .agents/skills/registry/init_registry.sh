#!/usr/bin/env bash

# Tiny init script for the MCP skill registry
# Creates the expected directory layout and a placeholder README.

set -e

# Base path – the script assumes it lives in .agents/skills/registry
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Create the skills directory where SKILL.md files will be stored
mkdir -p "$BASE_DIR/skills"

# Add a README explaining the purpose (optional but helpful)
cat <<'EOF' > "$BASE_DIR/README.md"
# Skill Registry

This directory is the root of the MCP **skill‑registry** server.

- Place generated `SKILL.md` files under `./skills/`.
- The `manifest.json` in the parent folder tells Antigravity how to expose them.
- The registry can be started/registered with:
  ```
  agy mcp register --name skill-registry --path .agents/skills/registry
  ```
EOF

echo "Registry init complete. Skills directory: $BASE_DIR/skills"
