# ===================================================================
# SecureEye — Start CCTV with ngrok (Global Access)
# ===================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "   SecureEye — CCTV Global Access      " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

Set-Location "d:\Demo rv\secureeye"

# Kill any existing node processes
Get-Process -Name node, tsx, npm -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Start backend in background
Write-Host "[1/3] Starting backend server..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "d:\Demo rv\secureeye"
    npm run backend:dev 2>&1 | Out-Null
}
Start-Sleep -Seconds 3
Write-Host "  ✓ Backend running on port 3000" -ForegroundColor Green

# Start CCTV in background
Write-Host "[2/3] Starting CCTV dashboard..." -ForegroundColor Yellow
$cctvJob = Start-Job -ScriptBlock {
    Set-Location "d:\Demo rv\secureeye"
    npm run cctv:dev 2>&1 | Out-Null
}
Start-Sleep -Seconds 2
Write-Host "  ✓ CCTV running on port 5000" -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Starting ngrok tunnel..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Your public URL will appear below." -ForegroundColor Cyan
Write-Host "  Share it to access SecureEye from anywhere!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login at: https://your-url.ngrok.io" -ForegroundColor Magenta
Write-Host "  Use your Firebase credentials to sign in" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor Gray
Write-Host ""

# Run ngrok (this blocks until Ctrl+C)
try {
    & "D:\ngrok\ngrok.exe" http 5000
} finally {
    # Cleanup
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Stop-Job $backendJob, $cctvJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $cctvJob -ErrorAction SilentlyContinue
    Get-Process -Name node, tsx -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "Stopped." -ForegroundColor Red
}
