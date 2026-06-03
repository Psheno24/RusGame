# Stop local RusGame dev processes (API + Vite).
$ErrorActionPreference = "SilentlyContinue"

Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like "*RussiaGame*" -or $_.CommandLine -like "*@russia-game*" } |
  ForEach-Object {
    Write-Host "Stopping node PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }

Start-Sleep -Seconds 1

$ports = 3001, 5173, 5174, 5175, 5176
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $procId = $_.OwningProcess
    if ($procId -and $procId -gt 0) {
      Write-Host "Stopping PID $procId (port $port)"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "Dev ports cleared."
