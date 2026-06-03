# Stop old dev, rebuild sqlite for current Node, start dev.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

& "$PSScriptRoot/kill-dev-ports.ps1"
Start-Sleep -Seconds 1

Write-Host "Rebuilding better-sqlite3 for Node $(node -v)..."
npm rebuild better-sqlite3 -w @russia-game/api

Write-Host "Starting dev..."
npm run dev
