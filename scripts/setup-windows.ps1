# One-time setup on Windows (PowerShell, repo root)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "=== RusGame: local setup ==="

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example"
}

Write-Host "Stopping old dev servers (ports 3001, 5173+)..."
powershell -ExecutionPolicy Bypass -File scripts/kill-dev-ports.ps1

Write-Host "npm install..."
npm install

Write-Host "Rebuilding better-sqlite3 for Node $(node -v)..."
npm rebuild better-sqlite3 -w @russia-game/api

git config --unset core.hooksPath 2>$null
Write-Host "Git hooks disabled (GitHub Desktop push without blockers)."

Write-Host ""
Write-Host "Done. Every day:"
Write-Host "  1) npm run dev          -> http://localhost:5173"
Write-Host "  2) GitHub Desktop Push  -> auto deploy (see deploy/GITHUB-ACTIONS.md)"
Write-Host ""
Write-Host "Starting dev..."
npm run dev
