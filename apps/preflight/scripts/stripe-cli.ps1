# Resolves stripe.exe when WinGet PATH is not loaded in the current shell.
$stripe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\stripe.exe'
if (-not (Test-Path $stripe)) {
	$stripe = 'stripe'
}
& $stripe @args
exit $LASTEXITCODE
