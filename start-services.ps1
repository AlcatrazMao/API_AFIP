# AFIP API - Start in Background
# Ejecuta el servidor y tunnel sin mostrar ventanas

$ErrorActionPreference = "Continue"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "🚀 Starting AFIP Services..." -ForegroundColor Green

# 1. Start Server (sin ventana)
$serverBat = @"
@echo off
cd /d "$projectDir\server"
npm run dev
"@

# Escribir batch temporal
$tempBat = "$env:TEMP\afip-server-temp.bat"
Set-Content -Path $tempBat -Value $serverBat -Encoding ASCII

# Ejecutar servidor en hidden window
$p1 = Start-Process "cmd.exe" -ArgumentList "/c $tempBat" -WindowStyle Hidden -PassThru
Write-Host "✅ Server started (PID: $($p1.Id))" -ForegroundColor Green

# 2. Start Tunnel (después de 3 segundos)
Start-Sleep -Seconds 3

$tunnelBat = @"
@echo off
cd /d "$projectDir"
cloudflared.exe tunnel --url http://localhost:3000
"@

$tempTunnel = "$env:TEMP\afip-tunnel-temp.bat"
Set-Content -Path $tempTunnel -Value $tunnelBat -Encoding ASCII

$p2 = Start-Process "cmd.exe" -ArgumentList "/c $tempTunnel" -WindowStyle Hidden -PassThru
Write-Host "✅ Tunnel started (PID: $($p2.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Services running in background!" -ForegroundColor Cyan
Write-Host "   - Server: http://localhost:3000" -ForegroundColor White
Write-Host "   - Tunnel: Check output for URL" -ForegroundColor White
Write-Host ""
Write-Host "To stop services, run: stop-services.ps1" -ForegroundColor Yellow
Write-Host "Or manually: Taskkill /PID $p1 /PID $p2 /F" -ForegroundColor Yellow

# Guardar PIDs para poder cerrar
@{
    ServerPID = $p1.Id
    TunnelPID = $p2.Id
} | ConvertTo-Json | Set-Content "$projectDir\.pids.json"

Write-Host ""
Write-Host "Presione cualquier tecla para salir..." -ForegroundColor Gray
Read-Host