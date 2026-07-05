#!/usr/bin/env node
/**
 * Phase 18 production smoke — run: node scripts/smoke-phase18.mjs
 * Optional: PREFLIGHT_BASE=https://deploylint.com
 */
const BASE = (
	process.env.DEPLOYLINT_BASE ??
	process.env.PREFLIGHT_BASE ??
	'https://deploylint.com'
).replace(/\/$/, '');
const BASE_HOST = new URL(BASE).hostname;

const results = [];

function pass(name, detail = '') {
	results.push({ name, ok: true, detail });
	console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
	results.push({ name, ok: false, detail });
	console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Environment limitation, not a pass — reported separately and excluded from the pass count. */
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

// 1. Static / dogfood routes
const llms = await get('/llms.txt');
if (llms.res.ok && llms.text.startsWith('# Deploylint')) pass('llms.txt', String(llms.res.status));
else fail('llms.txt', `${llms.res.status} ${llms.text.slice(0, 40)}`);

const securityTxt = await get('/.well-known/security.txt');
if (
	securityTxt.res.ok &&
	securityTxt.text.includes('Contact:') &&
	securityTxt.text.includes(BASE_HOST)
) {
	pass('security.txt', String(securityTxt.res.status));
} else fail('security.txt', `${securityTxt.res.status} ${securityTxt.text.slice(0, 40)}`);

const robots = await get('/robots.txt');
if (robots.res.ok && robots.text.includes('Allow: /'))
	pass('robots.txt', String(robots.res.status));
else fail('robots.txt', String(robots.res.status));

const home = await get('/');
if (home.res.ok && home.text.includes('og:image') && home.text.includes('application/ld+json')) {
	pass('homepage meta', 'og + json-ld in HTML');
} else fail('homepage meta');

if (
	home.text.includes('/s/script.js') &&
	home.text.includes('plausible.init') &&
	home.text.includes(BASE_HOST)
) {
	pass('Plausible', 'first-party proxy snippet in HTML (/s/script.js + plausible.init)');
} else fail('Plausible', 'expected /s/script.js proxy + plausible.init in HTML');

const proxyScript = await get('/s/script.js');
if (proxyScript.res.ok && proxyScript.text.includes('plausible')) {
	pass('Plausible proxy script', `${proxyScript.res.status} application/javascript`);
} else fail('Plausible proxy script', String(proxyScript.res.status));

const changelog = await get('/changelog');
if (
	changelog.res.ok &&
	changelog.text.includes('Changelog') &&
	/\[0\.\d+\.\d+\]/.test(changelog.text)
) {
	pass('/changelog', 'renders CHANGELOG versions');
} else fail('/changelog', String(changelog.res.status));

// 2. Exit criterion 1 — scan with issues shows embarrassment + prompts/unlock state
const scan = await post('/api/scan', { url: 'https://example.com' });
if (!scan.res.ok) {
	fail('scan example.com', `${scan.res.status} ${scan.text.slice(0, 120)}`);
} else {
	const r = scan.json;
	if (r.launchBrief?.embarrassmentRisks?.length > 0)
		pass('embarrassment brief', `${r.launchBrief.embarrassmentRisks.length} risks`);
	else fail('embarrassment brief', 'empty');

	const issues = r.checks?.filter((c) => c.status !== 'pass').length ?? 0;
	if (issues > 0 && (r.samplePromptId || r.unlocked)) {
		pass(
			'prompt access UX',
			r.unlocked
				? `${issues} issues, alpha unlocked`
				: `${issues} issues, sample=${r.samplePromptId}`
		);
	} else fail('prompt access UX', `issues=${issues} sample=${r.samplePromptId}`);

	if (r.verdict && typeof r.score === 'number') pass('verdict + score', `${r.verdict} ${r.score}`);
	else fail('verdict + score');

	const licCheck = r.checks?.find((c) => c.id === 'license-risk');
	if (r.licenseAudit && licCheck && r.licenseAudit.summary) {
		pass(
			'license audit',
			`${r.licenseAudit.libraries.length} libs, sellable=${r.licenseAudit.sellable}`
		);
	} else {
		fail('license audit', `audit=${Boolean(r.licenseAudit)} check=${licCheck?.status}`);
	}

	if (Array.isArray(r.pagesScanned) && r.pagesScanned[0]?.role === 'home') {
		pass('pages scanned', r.pagesScanned.map((p) => p.role).join(', '));
	} else {
		fail('pages scanned', `pagesScanned=${JSON.stringify(r.pagesScanned)}`);
	}
}

// 3. Exit criterion 3 — broken og:image fails og-image-live + social preview warning.
// Known limitation: the Worker cannot fetch its own zone (Cloudflare returns 522),
// so this check only runs when PREFLIGHT_BASE differs from the scanner's own domain.
const badOgScan = await post('/api/scan', { url: `${BASE}/fixtures/bad-og` });
if (badOgScan.res.ok) {
	const r = badOgScan.json;
	if (r.scanCoverage === 'blocked') {
		skip(
			'broken og:image',
			'worker cannot fetch its own zone (CF 522); covered by engine unit tests'
		);
	} else {
		const ogLive = r.checks?.find((c) => c.id === 'og-image-live');
		const previewIssues = r.socialPreview?.issues ?? [];
		const hasBrokenPreview =
			ogLive?.status === 'fail' ||
			previewIssues.some((i) => /failed to load|broken|empty/i.test(i));
		if (hasBrokenPreview) pass('broken og:image', ogLive?.status ?? 'preview warning');
		else fail('broken og:image', `og-image-live=${ogLive?.status} issues=${previewIssues.length}`);
	}
} else {
	fail('broken og:image scan', `${badOgScan.res.status}`);
}

// 3b. Blocked homepage guard — a 4xx/5xx homepage must produce exactly the two
// reachability checks and no content-check false positives. The fixture serves 403;
// the same-zone limitation may surface it as 522 — either way the guard must engage.
const blockedScan = await post('/api/scan', { url: `${BASE}/fixtures/blocked` });
if (blockedScan.res.ok) {
	const r = blockedScan.json;
	const checkIds = (r.checks ?? []).map((c) => c.id);
	const reachableMsg = r.checks?.[0]?.message ?? '';
	const statusMatch = reachableMsg.match(/\bHTTP ([45]\d{2})\b/);
	const guardEngaged =
		r.scanCoverage === 'blocked' &&
		checkIds.length === 2 &&
		checkIds.includes('reachable') &&
		checkIds.includes('https') &&
		statusMatch !== null;
	if (guardEngaged) {
		pass('blocked scan guard', `HTTP ${statusMatch[1]} → 2 checks, no content false positives`);
	} else {
		fail(
			'blocked scan guard',
			`coverage=${r.scanCoverage} checks=[${checkIds.join(',')}] msg=${reachableMsg}`
		);
	}
} else {
	fail('blocked scan fixture', `${blockedScan.res.status}`);
}

// 3c. Repo scan — GitHub repo URL routes to the repository auditor.
const repoScan = await post('/api/scan', { url: 'https://github.com/sindresorhus/slugify' });
if (repoScan.res.ok) {
	const r = repoScan.json;
	if (r.scanCoverage === 'blocked' && /rate limit/i.test(r.verdictMessage ?? '')) {
		skip('repo scan', 'GitHub API rate limit from shared Worker IP — set GITHUB_TOKEN secret');
	} else {
		const ids = (r.checks ?? []).map((c) => c.id);
		const ok =
			r.repo?.owner === 'sindresorhus' &&
			r.repo?.license === 'MIT' &&
			ids.includes('env-committed') &&
			ids.includes('repo-license') &&
			ids.includes('license-risk');
		if (ok) pass('repo scan', `${r.verdict} score=${r.score} deps=${r.repo.depCount}`);
		else fail('repo scan', `repo=${JSON.stringify(r.repo)} checks=[${ids.join(',')}]`);
	}
} else {
	fail('repo scan', `${repoScan.res.status}`);
}

// Reference scan (external)
const ext = await post('/api/scan', { url: 'https://www.google.com' });
if (ext.res.ok && ext.json.socialPreview?.title) pass('external social preview', 'parses og tags');
else if (ext.res.ok) pass('external social preview', 'scan ok');
else fail('external social preview', String(ext.res.status));

// 4. Funnel events endpoint
const evt = await post('/api/events', {
	event: 'scan_completed',
	verdict: 'conditional',
	score: 70,
	issueCount: 5
});
if (evt.res.ok && evt.json?.ok) pass('funnel /api/events', 'scan_completed accepted');
else fail('funnel /api/events', `${evt.res.status} ${evt.text.slice(0, 80)}`);

// 5. Exit criterion 2 — checkout API (Stripe must be configured on Worker)
const checkout = await post('/api/checkout', { url: 'https://example.com' });
if (checkout.res.ok && checkout.json?.url?.includes('checkout.stripe.com')) {
	pass('checkout session', checkout.json.sessionId ?? 'session created');
} else if (checkout.res.status === 429 && checkout.text.includes('Too many checkout attempts')) {
	pass('checkout session', 'checkout endpoint reachable; rate limit active');
} else if (checkout.res.status === 503) {
	fail(
		'checkout session',
		'Stripe not configured on Worker — run wrangler secret put STRIPE_SECRET_KEY'
	);
} else {
	fail('checkout session', `${checkout.res.status} ${checkout.text.slice(0, 120)}`);
}

// 6. Webhook endpoint alive
const wh = await get('/api/webhooks/stripe');
if (wh.res.ok && wh.text.trim() === 'ok') pass('webhook GET probe', 'endpoint reachable');
else fail('webhook GET probe', String(wh.res.status));

console.log('\n--- Summary ---');
const failed = results.filter((r) => !r.ok);
const skipped = results.filter((r) => r.skipped);
const asserted = results.length - skipped.length;
console.log(
	`${asserted - failed.length}/${asserted} passed${skipped.length ? ` (${skipped.length} skipped)` : ''}`
);
if (failed.length) {
	console.log('\nManual next steps:');
	for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
	process.exit(1);
}

console.log(
	'\nManual (human): complete one Stripe test checkout with card 4242… then re-scan for unlock delta.'
);
console.log(
	'Optional: stripe trigger checkout.session.completed (npm run stripe:test-webhook) → check CF logs for checkout_paid'
);
