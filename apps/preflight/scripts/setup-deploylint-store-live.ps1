# Deploylint live store — uses sk_live_ (not CLI rk_live restricted key).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$KeyFile = Join-Path $Root '.stripe-live.key'

if ($env:STRIPE_SECRET_KEY) {
	Write-Host 'Using STRIPE_SECRET_KEY from environment.' -ForegroundColor Cyan
	node (Join-Path $PSScriptRoot 'setup-deploylint-store-live.mjs')
	exit $LASTEXITCODE
}

if (Test-Path $KeyFile) {
	Write-Host "Using $KeyFile" -ForegroundColor Cyan
	node (Join-Path $PSScriptRoot 'setup-deploylint-store-live.mjs') --api-key-file '.stripe-live.key'
	exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'Deploylint live setup needs your sk_live_ secret key.' -ForegroundColor Yellow
Write-Host 'Stripe CLI is logged in but live mode uses restricted rk_live keys.' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Option A — paste once (saved to .stripe-live.key, gitignored):' -ForegroundColor Cyan
$secure = Read-Host 'sk_live_ secret key' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if (-not $key.StartsWith('sk_live_')) {
	Write-Error 'Expected sk_live_ key from https://dashboard.stripe.com/apikeys'
}
Set-Content -Path $KeyFile -Value $key -NoNewline
Write-Host "Saved to .stripe-live.key" -ForegroundColor Green
node (Join-Path $PSScriptRoot 'setup-deploylint-store-live.mjs') --api-key-file '.stripe-live.key'
