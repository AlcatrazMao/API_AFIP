# AFIP API - Stop Services
# Detiene el servidor y tunnel

$ErrorActionPreference = "Continue"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "🛑 Stopping AFIP Services..." -ForegroundColor Red

# Leer PIDs
$pidsFile = "$projectDir\.pids.json"
if (Test-Path $pidsFile) {
    $pids = Get-Content $pidsFile | ConvertFrom-Json
    
    if ($pids.ServerPID) {
        Write-Host "   Stopping Server (PID: $($pids.ServerPID))..."
        Stop-Process -Id $pids.ServerPID -Force -ErrorAction SilentlyContinue
    }
    
    if ($pids.TunnelPID) {
        Write-Host "   Stopping Tunnel (PID: $($pids.TunnelPID))..."
        Stop-Process -Id $pids.TunnelPID -Force -ErrorAction SilentlyContinue
    }
    
    Remove-Item $pidsFile -Force
}

# Limpiar procesos huérfanos también
Write-Host "🧹 Cleaning up..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "afip-server" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Services stopped!" -ForegroundColor Green