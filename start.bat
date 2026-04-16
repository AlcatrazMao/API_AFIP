@echo off
echo ========================================
echo  AFIP API - Starting Services
echo ========================================
echo.

echo [1] Starting AFIP Server...
start "AFIP Server" cmd /k "cd /d %~dp0server && npm run dev"

timeout /t 3 /nobreak >nul

echo [2] Starting Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /k "cd /d %~dp0 && cloudflared.exe tunnel --url http://localhost:3000"

echo.
echo ========================================
echo  DONE! Check both windows for:
echo  - Server running at http://0.0.0.0:3000
echo  - Tunnel URL (https://xxx.trycloudflare.com)
echo ========================================
pause