# AFIP API - Check Status
# Muestra el estado de los servicios y si hay errores

$ErrorActionPreference = "Continue"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "     AFIP API - STATUS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. Verificar Worker
# ============================================
Write-Host "🌐 Checking Worker..." -ForegroundColor Yellow

try {
    $workerResponse = Invoke-RestMethod -Uri "https://afip-api.m-a-o-alcatraz.workers.dev/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   Worker:  ✅ ONLINE" -ForegroundColor Green
    Write-Host "   $($workerResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   Worker:  ❌ OFFLINE" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# ============================================
# 2. Verificar Tunnel
# ============================================
Write-Host "🔗 Checking Tunnel..." -ForegroundColor Yellow

# Buscar proceso de cloudflared
$cloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "cloudflared" -or $_.CommandLine -match "localhost:3000" }

if ($cloudflared) {
    Write-Host "   Tunnel: ✅ ONLINE (PID: $($cloudflared.Id))" -ForegroundColor Green
    
    # Intentar verificar conexión al tunnel
    try {
        Start-Sleep -Seconds 1
        $tunnelUrl = "https://guide-saskatchewan-circus-moore.trycloudflare.com/health"
        $tunnelResponse = Invoke-RestMethod -Uri $tunnelUrl -TimeoutSec 5 -ErrorAction SilentlyContinue
        Write-Host "   Tunnel URL: $($tunnelUrl -replace 'https://', '')" -ForegroundColor Green
    } catch {
        Write-Host "   Tunnel URL: [Check tunnel console for URL]" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Tunnel: ❌ OFFLINE or not running" -ForegroundColor Red
}

Write-Host ""

# ============================================
# 3. Verificar Servidor Local
# ============================================
Write-Host "💻 Checking Server..." -ForegroundColor Yellow

$node = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "tsx|npm" }

if ($node) {
    Write-Host "   Server:  ✅ ONLINE (PID: $($node.Id))" -ForegroundColor Green
    
    # Verificar endpoint local
    try {
        $serverResponse = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
        Write-Host "   Local:   $($serverResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
    } catch {
        Write-Host "   Local:   Running but /health not responding" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Server:  ❌ OFFLINE" -ForegroundColor Red
}

Write-Host ""

# ============================================
# 4. Errores Recientes (últimos logs)
# ============================================
$logDir = "$projectDir\server"
$logFile = Get-ChildItem -Path $logDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($logFile -and ($logFile.LastWriteTime -gt (Get-Date).AddMinutes(-30)) {
    Write-Host "📋 Recent Errors:" -ForegroundColor Yellow
    
    $errors = Select-String -Path $logFile.FullName -Pattern "error|ERROR|Error" -ErrorAction SilentlyContinue | Select-Object -Last 5
    
    if ($errors) {
        $errors | ForEach-Object {
            Write-Host "   $($_.Line)" -ForegroundColor Red
        }
    } else {
        Write-Host "   No recent errors found" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

# ============================================
# 5. Test rápido de la API
# ============================================
Write-Host ""
Write-Host "🧪 Quick API Test..." -ForegroundColor Yellow

$testBody = @{
    client_name = "Test Check"
    client_cuit = "30711223334"
    invoice_type = 1
    invoice_letter = "A"
    items = @(
        @{
            description = "Test item"
            quantity = 1
            unit_price = 100
            iva_rate = 21
        }
    )
} | ConvertTo-Json

try {
    $apiResult = Invoke-RestMethod -Uri "https://afip-api.m-a-o-alcatraz.workers.dev/invoices" `
        -Method POST `
        -Headers @{"x-api-key"="Cinty777"; "Content-Type"="application/json"} `
        -Body $testBody `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    if ($apiResult.status -eq "PENDING") {
        Write-Host "   ✅ API fully operational!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  API responding but status: $($apiResult.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ API test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""