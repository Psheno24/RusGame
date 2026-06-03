#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/pre-push 2>/dev/null || true
echo "Git hooks включены (.githooks/pre-push)."
echo "Перед push: npm run build + npm test (как в Docker)."
