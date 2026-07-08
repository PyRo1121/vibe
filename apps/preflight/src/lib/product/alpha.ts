export const ALPHA_FREE_UNLOCK_ENV = 'DEPLOYLINT_ALPHA_FREE_UNLOCK';

export const ALPHA_PRICE_PREVIEW = {
	current: 'Free review, paid repair workflow',
	later: 'Solo starts at $9/mo',
	hiddenLater: [
		'10 readiness briefs per month on Solo',
		'Saved readiness history and exports',
		'Every guided fix plus one full repair plan',
		'CVE alerts and security notifications for monitored targets'
	]
} as const;

export const ALPHA_DISCLAIMER =
	'Free reviews show the verdict, public checklist, and one sample fix. Subscriptions unlock every guided fix, the full repair plan, MCP workflow access, verification proof, and recurring monitoring.';

export const ALPHA_FREE_DISCLAIMER =
	'Free mode is enabled for this deployment. Full reports are included while the product is learning from real usage, and checkout stays out of the way.';

function flagEnabled(value: unknown): boolean {
	return typeof value === 'string' && /^(1|true|yes|on)$/i.test(value.trim());
}

function flagDisabled(value: unknown): boolean {
	return typeof value === 'string' && /^(0|false|no|off)$/i.test(value.trim());
}

export function resolveAlphaFreeUnlock(env?: { DEPLOYLINT_ALPHA_FREE_UNLOCK?: unknown }): boolean {
	const value = env?.[ALPHA_FREE_UNLOCK_ENV];
	if (flagDisabled(value)) return false;
	if (flagEnabled(value)) return true;
	return true;
}
