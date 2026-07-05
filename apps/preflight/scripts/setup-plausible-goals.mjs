#!/usr/bin/env node
/**
 * Create Deploylint funnel goals via Plausible Plugins API.
 *
 * Usage:
 *   PLAUSIBLE_PLUGIN_TOKEN=plausible-plugin-... node scripts/setup-plausible-goals.mjs
 *   npm run setup:plausible-goals -w preflight
 *
 * Get token: Plausible → lint.latham.cloud → Settings → Plugin Token
 */
const TOKEN = process.env.PLAUSIBLE_PLUGIN_TOKEN?.trim();
const API = 'https://plausible.io/api/plugins/v1/goals';

const FUNNEL_GOALS = [
	'scan_completed',
	'unlock_click',
	'checkout_started',
	'checkout_paid',
	'rescan_completed'
];

if (!TOKEN) {
	console.error('Set PLAUSIBLE_PLUGIN_TOKEN (plausible-plugin-... from site settings).');
	process.exit(1);
}

if (!TOKEN.startsWith('plausible-plugin-')) {
	console.error('PLAUSIBLE_PLUGIN_TOKEN should start with plausible-plugin-');
	process.exit(1);
}

const auth = Buffer.from(`:${TOKEN}`).toString('base64');

for (const event_name of FUNNEL_GOALS) {
	const res = await fetch(API, {
		method: 'PUT',
		headers: {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ goal: { goal_type: 'CustomEvent', event_name } })
	});

	const text = await res.text();
	if (res.ok || res.status === 201) {
		console.log(`✓ ${event_name}`);
		continue;
	}

	console.error(`✗ ${event_name} — HTTP ${res.status} ${text.slice(0, 200)}`);
	process.exit(1);
}

console.log('\nAll funnel goals configured. Fire each event once, then check Plausible → Goals.');
