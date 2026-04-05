# SecureEye Web Dashboard — Quick Start
#
# This script starts the backend server and opens ngrok
# to make your SecureEye dashboard public.
#
# Prerequisites:
#   1. Install ngrok: https://ngrok.com/download
#   2. Sign up (free) and run: ngrok config add-authtoken <YOUR_TOKEN>

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "   SecureEye — Web Dashboard Launcher   " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Start backend server in background
Write-Host "[1/2] Starting SecureEye backend..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    npm run backend:dev
}

Start-Sleep -Seconds 3

# Check if backend is running
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
    Write-Host "  Backend is running!" -ForegroundColor Green
    Write-Host "  Local URL: http://localhost:3000" -ForegroundColor Cyan
} catch {
    Write-Host "  Backend may still be starting..." -ForegroundColor Yellow
    Write-Host "  Local URL: http://localhost:3000" -ForegroundColor Cyan
}

Write-Host ""

# Start ngrok
Write-Host "[2/2] Starting ngrok tunnel..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Your public URL will appear below." -ForegroundColor Cyan
Write-Host "  Share it with anyone to access your dashboard!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor Gray
Write-Host ""

# Run ngrok (this blocks until Ctrl+C)
ngrok http 3000

# Cleanup
Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -ErrorAction SilentlyContinue
Write-Host "Stopped." -ForegroundColor Red
