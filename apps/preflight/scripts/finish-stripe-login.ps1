# Finishes Stripe CLI login after browser approval, then creates Preflight webhook.
$ErrorActionPreference = 'Stop'

$stripe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\stripe.exe'
if (-not (Test-Path $stripe)) { $stripe = 'stripe' }

$configPath = Join-Path $env:USERPROFILE '.config\stripe\config.toml'
if (Test-Path $configPath) {
	Write-Host 'Stripe CLI already logged in.' -ForegroundColor Green
	& $stripe config --list
} else {
	Write-Host 'Starting Stripe CLI login (browser will open)...' -ForegroundColor Cyan
	& $stripe login
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
	Write-Host 'Stripe CLI login complete.' -ForegroundColor Green
}

& $PSScriptRoot\setup-stripe.ps1
