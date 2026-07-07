#!/usr/bin/env node
/**
 * Phase 19 production smoke — CI deploy gate wedge
 * Run: npm run smoke:phase19 (from apps/preflight)
 */
import { installFetchRetry } from './smoke-http.mjs';

installFetchRetry();

const BASE = (
	process.env.DEPLOYLINT_BASE ??
	process.env.PREFLIGHT_BASE ??
	'https://deploylint.com'
).replace(/\/$/, '');

const results = [];

function pass(name, detail = '') {
	results.push({ name, ok: true, detail });
	console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
	results.push({ name, ok: false, detail });
	console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path) {
	const res = await fetch(`${BASE}${path}`);
	const text = await res.text();
	return { res, text };
}

// 1. Developers docs page
const dev = await get('/developers');
if (dev.res.ok && dev.text.includes('Add a deploy-risk report to every pull request')) {
	pass('developers page', String(dev.res.status));
} else {
	fail('developers page', String(dev.res.status));
}

if (dev.text.includes('DEPLOYLINT_URL') && dev.text.includes('gate-remote.mjs')) {
	pass('developers setup docs', 'advisory workflow + hosted script');
} else {
	fail('developers setup docs');
}

if (
	dev.text.includes('deploylint_scan') &&
	dev.text.includes('deploylint_gate') &&
	dev.text.includes('gate-remote.mjs')
) {
	pass('developers MCP docs');
} else {
	fail('developers MCP docs');
}

// 2. Hosted gate script
const gateScript = await get('/gate-remote.mjs');
if (
	gateScript.res.ok &&
	gateScript.text.includes('evaluateGate') &&
	gateScript.text.startsWith('#!/')
) {
	pass('hosted gate-remote.mjs', String(gateScript.res.status));
} else {
	fail('hosted gate-remote.mjs', String(gateScript.res.status));
}

// 3. Homepage CI teaser
const home = await get('/');
if (home.text.includes('/developers') && home.text.includes('Block bad deploys in CI')) {
	pass('homepage CI teaser');
} else {
	fail('homepage CI teaser');
}

// 4. llms.txt mentions CI
const llms = await get(`/llms.txt?_=${Date.now()}`);
if (llms.res.ok && llms.text.includes('CI hardening') && llms.text.includes('/developers')) {
	pass('llms.txt CI mention');
} else {
	fail('llms.txt CI mention');
}

// 5. Header nav link
if (
	(home.text.includes('href="/developers"') || home.text.includes('href="./developers"')) &&
	home.text.includes('CI gate')
) {
	pass('header nav link');
} else {
	fail('header nav link');
}

// 6. Gate script runs against example.com (should fail or pass — must exit cleanly via API)
const scanRes = await fetch(`${BASE}/api/scan`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ url: 'https://example.com' })
});
if (scanRes.ok) {
	const report = await scanRes.json();
	if (report.verdict && typeof report.score === 'number') {
		pass('gate API reachable', `${report.verdict} ${report.score}`);
	} else {
		fail('gate API reachable', 'missing verdict/score');
	}
} else {
	fail('gate API reachable', String(scanRes.status));
}

const passed = results.filter((r) => r.ok).length;
const total = results.length;

console.log('\n--- Summary ---');
console.log(`${passed}/${total} passed`);

if (passed < total) process.exit(1);

console.log(
	'\nManual: add DEPLOYLINT_URL secret to a repo and run the advisory workflow from /developers'
);
