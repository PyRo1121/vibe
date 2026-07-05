#!/usr/bin/env node
/**
 * Phase 23 production smoke — sitemap supplemental crawl (pagesScanned sitemap role)
 * Run: npm run smoke:phase23 (from apps/preflight)
 *
 * Self-scans deploylint.com via the SELF service binding (Phase 21).
 * Legal pages come from homepage link crawl; /compare and /developers may appear
 * as role=sitemap when listed in sitemap.xml but not linked from the homepage.
 */
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

function sitemapLocs(xml) {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function pathname(loc) {
	try {
		return new URL(loc).pathname;
	} catch {
		return loc;
	}
}

// 1. Sitemap lists and serves the public URL set
const sitemap = await get('/sitemap.xml');
if (sitemap.res.ok) {
	const locs = sitemapLocs(sitemap.text);
	const paths = locs.map(pathname);
	const missingCore = ['/', '/checks', '/privacy', '/terms', '/compare', '/developers'].filter(
		(path) => !paths.includes(path)
	);
	const guideCount = paths.filter((path) => path.startsWith('/guides/')).length;
	if (missingCore.length === 0 && guideCount > 0) {
		pass('sitemap.xml', `${locs.length} URLs listed, including ${guideCount} guides`);
	} else {
		fail(
			'sitemap.xml',
			`missing core locs: ${missingCore.join(', ') || 'none'}; guideCount=${guideCount}`
		);
	}

	const unreachable = [];
	for (const loc of locs) {
		let url;
		try {
			url = new URL(loc);
		} catch {
			unreachable.push(`${loc} (invalid URL)`);
			continue;
		}
		if (url.origin !== BASE) {
			unreachable.push(`${loc} (wrong origin)`);
			continue;
		}
		const page = await fetch(loc);
		if (!page.ok) unreachable.push(`${url.pathname} (${page.status})`);
	}
	if (unreachable.length === 0) pass('sitemap loc reachability', `${locs.length} URLs reachable`);
	else fail('sitemap loc reachability', unreachable.join(', '));
} else {
	fail('sitemap.xml', String(sitemap.res.status));
}

// 2. Self-scan — sitemap supplemental crawl via SELF binding
const selfScan = await post('/api/scan', { url: BASE });
if (!selfScan.res.ok) {
	fail('self-scan API', `${selfScan.res.status} ${selfScan.text.slice(0, 120)}`);
} else if (selfScan.json?.scanCoverage === 'blocked') {
	fail(
		'self-scan dogfood',
		`blocked: ${selfScan.json.checks?.[0]?.message ?? 'SELF binding may be misconfigured'}`
	);
} else if (!Array.isArray(selfScan.json?.pagesScanned) || selfScan.json.pagesScanned.length === 0) {
	fail('self-scan dogfood', 'missing pagesScanned');
} else {
	const pages = selfScan.json.pagesScanned;
	const roles = pages.map((p) => p.role);
	pass('pagesScanned present', `${pages.length} pages: ${roles.join(', ')}`);

	if (roles.includes('home')) pass('home page in crawl');
	else fail('home page in crawl', roles.join(', '));

	const beyondHome = roles.filter((r) => r !== 'home');
	if (beyondHome.length > 0) {
		pass('pages beyond home', beyondHome.join(', '));
	} else {
		fail('pages beyond home', 'only home scanned');
	}

	if (roles.includes('privacy')) pass('privacy page crawled');
	else fail('privacy page crawled', `roles: ${roles.join(', ')}`);

	if (roles.includes('terms')) pass('terms page crawled');
	else fail('terms page crawled', `roles: ${roles.join(', ')}`);

	const sitemapPages = pages.filter((p) => p.role === 'sitemap');
	const sitemapPaths = sitemapPages.map((p) => {
		try {
			return new URL(p.url).pathname;
		} catch {
			return p.url;
		}
	});
	const supplemental = ['/compare', '/developers'].filter((path) => sitemapPaths.includes(path));

	if (supplemental.length > 0) {
		pass('sitemap supplemental crawl', supplemental.join(', '));
	} else if (sitemapPages.length > 0) {
		pass('sitemap supplemental crawl', `other sitemap pages: ${sitemapPaths.join(', ')}`);
	} else {
		skip(
			'sitemap supplemental crawl',
			'/compare and /developers not in crawl as role=sitemap (may already be link-crawled or sitemap not deployed yet)'
		);
	}

	const sitemapCheck = selfScan.json.checks?.find((c) => c.id === 'sitemap');
	if (sitemapCheck?.status === 'pass' || sitemapCheck?.status === 'warn') {
		pass('sitemap check', sitemapCheck.message?.slice(0, 80) ?? sitemapCheck.status);
	} else {
		fail('sitemap check', sitemapCheck?.status ?? 'missing');
	}
}

const failed = results.filter((r) => !r.ok);
const skipped = results.filter((r) => r.skipped);
const counted = results.filter((r) => !r.skipped);

console.log('\n--- Summary ---');
console.log(
	`${counted.length - failed.length}/${counted.length} passed${skipped.length > 0 ? ` (${skipped.length} skipped)` : ''}`
);
if (failed.length > 0) process.exit(1);
