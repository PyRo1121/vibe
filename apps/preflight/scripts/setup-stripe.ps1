# TEST MODE — run after `npm run stripe -- login`.
# Creates a test-mode webhook + prints wrangler secret commands (no real charges).
# For production live keys, use scripts/setup-stripe-live.ps1 instead.
$ErrorActionPreference = 'Stop'

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

Write-Host "`nCreating webhook endpoint for $WebhookUrl ..." -ForegroundColor Cyan
$createArgs = @(
	'webhook_endpoints', 'create',
	'--url', $WebhookUrl,
	'--description', 'Deploylint production',
	'-c'
)
foreach ($event in $Events) {
	$createArgs += @('--enabled-events', $event)
}

$json = & $stripe @createArgs 2>&1 | Out-String
Write-Host $json

if ($json -match '"secret"\s*:\s*"(whsec_[^"]+)"') {
	$whsec = $Matches[1]
	Write-Host "`nWebhook signing secret:" -ForegroundColor Green
	Write-Host $whsec
	Write-Host "`nSet on Cloudflare (paste when prompted):" -ForegroundColor Yellow
	Write-Host "  npx wrangler secret put STRIPE_WEBHOOK_SECRET"
	Write-Host "  (paste: $whsec)"
} else {
	Write-Host "`nCould not parse webhook secret. Check Stripe Dashboard → Webhooks." -ForegroundColor Yellow
	& $stripe webhook_endpoints list -c
}

Write-Host "`n--- STRIPE_SECRET_KEY ---" -ForegroundColor Yellow
Write-Host "Copy your test secret key from: https://dashboard.stripe.com/test/apikeys"
Write-Host "Then run: npx wrangler secret put STRIPE_SECRET_KEY"
Write-Host "`nAfter both secrets are set: npm run deploy"
