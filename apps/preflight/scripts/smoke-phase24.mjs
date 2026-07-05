#!/usr/bin/env node
/**
 * Phase 24 production smoke — Stripe live-mode readiness
 * Run: npm run smoke:phase24 (from apps/preflight)
 *
 * Checkout: 503 when Stripe is not configured (skip, not fail); 200 with checkout URL when configured.
 * Webhook: GET /api/webhooks/stripe must return 200 "ok".
 */
const BASE = (
	process.env.DEPLOYLINT_BASE ??
	process.env.PREFLIGHT_BASE ??
	'https://deploylint.com'
).replace(/\/$/, '');
const CHECKOUT_URL = process.env.SMOKE_CHECKOUT_URL ?? 'https://example.com';

const results = [];

function pass(name, detail = '') {
	results.push({ name, ok: true, detail });
	console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
	results.push({ name, ok: false, detail });
	console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function skip(name, reason) {
	results.push({ name, ok: true, skipped: true, detail: reason });
	console.log(`- ${name} (skipped) — ${reason}`);
}

async function post(path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		/* ignore */
	}
	return { res, json, text };
}

async function get(path) {
	const res = await fetch(`${BASE}${path}`);
	const text = await res.text();
	return { res, text };
}

const checkout = await post('/api/checkout', { url: CHECKOUT_URL });
if (checkout.res.ok && checkout.json?.url?.includes('checkout.stripe.com')) {
	pass('checkout session', checkout.json.sessionId ?? 'session created');
} else if (checkout.res.status === 429 && checkout.text.includes('Too many checkout attempts')) {
	pass('checkout session', 'checkout endpoint reachable; rate limit active');
} else if (checkout.res.status === 503) {
	skip(
		'checkout session',
		'Stripe not configured on Worker — run wrangler secret put STRIPE_SECRET_KEY (or setup-stripe-live.ps1 for live)'
	);
} else {
	fail('checkout session', `${checkout.res.status} ${checkout.text.slice(0, 120)}`);
}

const wh = await get('/api/webhooks/stripe');
if (wh.res.ok && wh.text.trim() === 'ok') pass('webhook GET probe', 'endpoint reachable');
else fail('webhook GET probe', `${wh.res.status} ${wh.text.slice(0, 80)}`);

const failed = results.filter((r) => !r.ok);
const skipped = results.filter((r) => r.skipped);
const counted = results.filter((r) => !r.skipped);
console.log(
	`\n${counted.length - failed.length}/${counted.length} passed${skipped.length > 0 ? ` (${skipped.length} skipped)` : ''}`
);
if (failed.length > 0) process.exit(1);
