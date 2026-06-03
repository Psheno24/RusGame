# Run once from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-dev-hooks.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
git config core.hooksPath .githooks
Write-Host "Git hooks enabled: .githooks/pre-push runs build and API tests before push."
Write-Host "Next: git push origin main. On server: bash deploy/update.sh (or rusgame-update after setup)."
