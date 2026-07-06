export const ALPHA_FREE_UNLOCK_ENV = 'DEPLOYLINT_ALPHA_FREE_UNLOCK';

export const ALPHA_PRICE_PREVIEW = {
	current: 'Free scan, paid fix plan',
	later: 'Solo starts at $9/mo',
	hiddenLater: [
		'10 full reports per month on Solo',
		'Saved report history and exports',
		'Every Cursor-ready fix prompt and one master repair paste',
		'CVE alerts and security notifications for monitored targets'
	]
} as const;

export const ALPHA_DISCLAIMER =
	'Free scans show the verdict, public checklist, and one sample fix prompt. Subscriptions unlock every prompt, the master repair paste, MCP access, re-scan proof, and recurring monitoring.';

export const ALPHA_FREE_DISCLAIMER =
	'Alpha mode is enabled for this deployment. Full reports are free while the product is still being shaped, and checkout stays out of the way.';

function flagEnabled(value: unknown): boolean {
	return typeof value === 'string' && /^(1|true|yes|on)$/i.test(value.trim());
}

export function resolveAlphaFreeUnlock(env?: { DEPLOYLINT_ALPHA_FREE_UNLOCK?: unknown }): boolean {
	return flagEnabled(env?.[ALPHA_FREE_UNLOCK_ENV]);
}
