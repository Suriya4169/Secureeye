# ===================================================================
# SecureEye — Start CCTV with Tailscale (Global Access)
# ===================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SecureEye — Tailscale Global Setup   " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "D:\Demo rv\secureeye"

# Check if Tailscale is running
Write-Host "[1/3] Checking Tailscale..." -ForegroundColor Yellow

try {
    $tailscaleStatus = & "C:\Program Files\Tailscale\tailscale.exe" status 2>$null
    
    if ($tailscaleStatus -match "100\.") {
        # Extract the Tailscale IP (100.x.x.x address)
        $tailscaleIP = $tailscaleStatus | Select-String -Pattern "100\.\d+\.\d+\.\d+" | ForEach-Object { $_.Matches[0].Value }
        
        if ($tailscaleIP) {
            Write-Host "  ✓ Tailscale connected: $tailscaleIP" -ForegroundColor Green
            Write-Host ""
        } else {
            throw "Could not extract Tailscale IP"
        }
    } else {
        throw "Tailscale not connected"
    }
} catch {
    Write-Host "  ✗ Tailscale not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please:" -ForegroundColor Yellow
    Write-Host "    1. Download Tailscale: https://tailscale.com/download/windows" -ForegroundColor White
    Write-Host "    2. Install and run it" -ForegroundColor White
    Write-Host "    3. Click 'Connect'" -ForegroundColor White
    Write-Host "    4. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Kill any existing node processes
Write-Host "[2/3] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "  ✓ Ready" -ForegroundColor Green

# Start the CCTV server
Write-Host "[3/3] Starting CCTV server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  🛡️  SecureEye CCTV is starting..." -ForegroundColor Cyan
Write-Host "  🌐 Access from any device on Tailscale:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  http://$tailscaleIP:5000" -ForegroundColor Magenta
Write-Host ""
Write-Host "  📱 Mobile access:" -ForegroundColor Cyan
Write-Host "   - Connect phone to Tailscale" -ForegroundColor Gray
Write-Host "   - Open: http://$tailscaleIP:5000 on mobile" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop server" -ForegroundColor Gray
Write-Host ""

cd "D:\Demo rv\secureeye\laptop-cctv"
node server.js
