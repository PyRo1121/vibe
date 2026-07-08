# LIVE MODE — run after `npm run stripe -- login`.
# Creates a live-mode webhook + prints wrangler secret commands.
# WARNING: live keys process real charges. Use scripts/setup-stripe.ps1 for test mode.
$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '*** LIVE MODE — REAL CHARGES ***' -ForegroundColor Red
Write-Host 'This legacy script configures Stripe live keys and a production webhook only.' -ForegroundColor Red
Write-Host 'Use npm run setup:deploylint-store:live for subscription Products and Prices.' -ForegroundColor Red
Write-Host ''

$stripe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\stripe.exe'
if (-not (Test-Path $stripe)) { $stripe = 'stripe' }

$WebhookUrl = 'https://deploylint.com/api/webhooks/stripe'
$Events = @(
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'checkout.session.async_payment_failed',
	'invoice.payment_failed',
	'invoice.paid',
	'customer.subscription.deleted'
)

Write-Host "Checking Stripe CLI login..." -ForegroundColor Cyan
& $stripe config --list | Out-Null

Write-Host "`nCreating LIVE webhook endpoint for $WebhookUrl ..." -ForegroundColor Cyan
$createArgs = @(
	'webhook_endpoints', 'create',
	'--live',
	'--url', $WebhookUrl,
	'--description', 'Deploylint production (live)',
	'-c'
)
foreach ($event in $Events) {
	$createArgs += @('--enabled-events', $event)
}

$json = & $stripe @createArgs 2>&1 | Out-String
Write-Host $json

if ($json -match '"secret"\s*:\s*"(whsec_[^"]+)"') {
	$whsec = $Matches[1]
	Write-Host "`nLive webhook signing secret:" -ForegroundColor Green
	Write-Host $whsec
	Write-Host "`nSet on Cloudflare (paste when prompted):" -ForegroundColor Yellow
	Write-Host "  npx wrangler secret put STRIPE_WEBHOOK_SECRET"
	Write-Host "  (paste: $whsec)"
} else {
	Write-Host "`nCould not parse webhook secret. Check Stripe Dashboard → Webhooks (live mode)." -ForegroundColor Yellow
	& $stripe webhook_endpoints list --live
}

Write-Host "`n--- STRIPE_SECRET_KEY (live) ---" -ForegroundColor Yellow
Write-Host "Copy your live secret key from: https://dashboard.stripe.com/apikeys"
Write-Host "Then run: npx wrangler secret put STRIPE_SECRET_KEY"
Write-Host "`nAfter both secrets are set: npm run deploy"
