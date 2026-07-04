#!/usr/bin/env node
/**
 * Phase 20 production smoke — multi-page scan (legal crawl + pagesScanned)
 * Run: npm run smoke:phase20 (from apps/preflight)
 *
 * Uses an external site with footer legal links. The Worker cannot fetch its own
 * zone (Cloudflare returns 522), so dogfooding preflight.latham.cloud is skipped.
 */
const BASE = (process.env.PREFLIGHT_BASE ?? 'https://preflight.latham.cloud').replace(/\/$/, '');
/** Stable public site with /privacy and /terms linked from the homepage. */
const MULTIPAGE_URL =
	process.env.SMOKE_MULTIPAGE_URL ?? 'https://plausible.io';

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

const scan = await post('/api/scan', { url: MULTIPAGE_URL });
if (!scan.res.ok) {
	fail('multipage scan API', `${scan.res.status} ${scan.text.slice(0, 120)}`);
} else if (scan.json?.scanCoverage === 'blocked') {
	skip(
		'multipage crawl',
		`scan blocked for ${MULTIPAGE_URL} — set SMOKE_MULTIPAGE_URL to another site with legal links`
	);
} else if (!scan.json?.pagesScanned) {
	fail('multipage scan API', `missing pagesScanned for ${MULTIPAGE_URL}`);
} else {
	const roles = scan.json.pagesScanned.map((p) => p.role);
	pass('pagesScanned present', roles.join(', '));

	if (roles.includes('home')) pass('home page in crawl');
	else fail('home page in crawl', roles.join(', '));

	if (roles.includes('privacy')) pass('privacy page crawled');
	else fail('privacy page crawled', `no privacy in crawl for ${MULTIPAGE_URL}`);

	if (roles.includes('terms')) pass('terms page crawled');
	else fail('terms page crawled', `no terms in crawl for ${MULTIPAGE_URL}`);

	const privacy = scan.json.checks?.find((c) => c.id === 'privacy');
	if (privacy?.status === 'pass') {
		pass('privacy check verified content', privacy.message?.slice(0, 60) ?? '');
	} else {
		fail('privacy check verified content', privacy?.status ?? 'missing');
	}
}

// Self-scan dogfood — same-zone fetch uses the SELF service binding (Phase 21).
const selfScan = await post('/api/scan', { url: BASE });
if (selfScan.res.ok && selfScan.json?.scanCoverage === 'blocked') {
	fail('self-scan dogfood', `still blocked: ${selfScan.json.checks?.[0]?.message ?? 'unknown'}`);
} else if (selfScan.res.ok && selfScan.json?.pagesScanned?.length > 1) {
	pass('self-scan dogfood', selfScan.json.pagesScanned.map((p) => p.role).join(', '));
} else if (selfScan.res.ok && selfScan.json?.pagesScanned) {
	pass('self-scan dogfood', selfScan.json.pagesScanned.map((p) => p.role).join(', '));
} else {
	fail('self-scan dogfood', selfScan.text.slice(0, 120));
}

const failed = results.filter((r) => !r.ok);
const counted = results.filter((r) => !r.skipped);
console.log(`\n${counted.length - failed.length}/${counted.length} passed`);
if (failed.length) process.exit(1);
