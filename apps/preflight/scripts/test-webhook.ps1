# Send a test Stripe webhook event to production (requires Stripe CLI login).
$ErrorActionPreference = 'Stop'
$stripe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\stripe.exe'
if (-not (Test-Path $stripe)) { $stripe = 'stripe' }

Write-Host "Triggering checkout.session.completed to registered webhooks..." -ForegroundColor Cyan
& $stripe trigger checkout.session.completed
