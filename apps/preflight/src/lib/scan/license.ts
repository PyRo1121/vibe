import type {
	DetectedLibrary,
	LicenseAudit,
	LicenseCategory,
	CheckStatus,
	Sellability
} from '$lib/scan/types';
import { canonicalName, HOST_RULES, KNOWN, SPDX_FAMILIES, UNKNOWN_LIB } from '$lib/scan/license-db';

/**
 * License & sell-rights audit.
 * Detects third-party libraries from CDN URLs, self-hosted filenames, and license
 * banners inside fetched scripts, then answers: "Can you sell a product built on this?"
 * Pure parsing — no network calls. The curated facts live in $lib/scan/license-db.
 */

function makeLibrary(rawName: string, version: string | null, source: string): DetectedLibrary {
	const name = canonicalName(rawName);
	const info = KNOWN[name] ?? UNKNOWN_LIB;
	return { name, version, source, ...info };
}

function parseCdnUrl(url: URL): { name: string; version: string | null } | null {
	const host = url.hostname;
	const path = url.pathname;

	for (const rule of HOST_RULES) {
		if (rule.pattern.test(host)) return { name: rule.name, version: null };
	}

	if (host === 'cdn.jsdelivr.net' || host === 'fastly.jsdelivr.net') {
		const m = path.match(/^\/npm\/((?:@[\w.-]+\/)?[\w.-]+)@([^/]+)/);
		if (m) return { name: m[1], version: m[2] };
		const gh = path.match(/^\/gh\/[\w.-]+\/([\w.-]+)@([^/]+)/);
		if (gh) return { name: gh[1], version: gh[2] };
		return null;
	}

	if (host === 'unpkg.com') {
		const m = path.match(/^\/((?:@[\w.-]+\/)?[\w.-]+)@([^/]+)/);
		if (m) return { name: m[1], version: m[2] };
		const bare = path.match(/^\/((?:@[\w.-]+\/)?[\w.-]+)(\/|$)/);
		if (bare) return { name: bare[1], version: null };
		return null;
	}

	if (host === 'cdnjs.cloudflare.com' || host === 'ajax.googleapis.com') {
		const m = path.match(/^\/ajax\/libs\/([\w.-]+)\/([^/]+)/);
		if (m) return { name: m[1], version: m[2] };
		return null;
	}

	if (host === 'code.jquery.com') {
		const m = path.match(/jquery(?:-(\d+(?:\.\d+)*(?:-[a-z0-9.]+)?))?(?:\.slim)?(?:\.min)?\.js$/);
		if (m) return { name: 'jquery', version: m[1] ?? null };
		return null;
	}

	return null;
}

/** Self-hosted copies of known libraries, e.g. /assets/jquery-3.6.0.min.js */
function parseFilename(url: URL): { name: string; version: string | null } | null {
	const file = url.pathname.split('/').pop() ?? '';
	const m = file.match(
		/^([a-z@][\w.-]*?)(?:[.-](\d+(?:\.\d+)+))?(?:\.slim|\.umd|\.esm|\.bundle)?(?:\.min)?\.(?:js|css)$/i
	);
	if (!m) return null;
	const name = canonicalName(m[1]);
	if (!(name in KNOWN)) return null;
	return { name, version: m[2] ?? null };
}

function extractAssetUrls(html: string, base: URL): URL[] {
	const seen = new Set<string>();
	const urls: URL[] = [];

	const push = (raw: string) => {
		try {
			const url = new URL(raw, base);
			if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
			if (seen.has(url.href)) return;
			seen.add(url.href);
			urls.push(url);
		} catch {
			/* unparseable URL — skip */
		}
	};

	for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) push(m[1]);
	for (const m of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)) push(m[1]);

	return urls;
}

/** Detect libraries from CDN URLs and recognizable self-hosted filenames in the page HTML. */
export function detectLibraries(html: string, base: URL): DetectedLibrary[] {
	const found = new Map<string, DetectedLibrary>();

	for (const url of extractAssetUrls(html, base)) {
		const hit = parseCdnUrl(url) ?? parseFilename(url);
		if (!hit) continue;
		const lib = makeLibrary(hit.name, hit.version, url.hostname);
		const existing = found.get(lib.name);
		if (!existing || (!existing.version && lib.version)) found.set(lib.name, lib);
	}

	return [...found.values()];
}

export function classifySpdx(spdx: string): {
	category: LicenseCategory;
	sellable: Sellability;
	note: string;
} {
	for (const family of SPDX_FAMILIES) {
		if (family.pattern.test(spdx)) return family;
	}
	return { category: 'unknown', sellable: 'unknown', note: UNKNOWN_LIB.note };
}

/**
 * Scan a fetched script body for license banners. Returns a finding only when it
 * affects sell rights (copyleft / non-commercial / restrictive) — permissive
 * banners are expected and would be noise.
 */
export function auditScriptText(text: string, source: string): DetectedLibrary | null {
	const spdxMatch = text.match(/SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+)/);
	const licenseTag = text.match(/@license\s+((?:AGPL|GPL|LGPL|MPL|EPL|CC-BY-NC)[A-Za-z0-9.+-]*)/i);
	const gplBanner = /GNU (Affero )?General Public License/i.test(text.slice(0, 30_000));

	const spdx = spdxMatch?.[1] ?? licenseTag?.[1] ?? (gplBanner ? 'GPL' : null);
	if (!spdx) return null;

	const classified = classifySpdx(spdx);
	if (classified.sellable === 'yes') return null;

	const file = source.split('/').pop() || source;
	return {
		name: `bundled code (${file})`,
		version: null,
		source: file,
		license: spdx,
		spdx: spdxMatch?.[1] ?? null,
		...classified
	};
}

/**
 * Describe an npm dependency for the license audit. Curated KNOWN facts win
 * (better notes for gsap/highcharts/etc.); otherwise the registry's license
 * string is classified by SPDX family.
 */
export function describeNpmDependency(
	name: string,
	version: string | null,
	license: string | null
): DetectedLibrary {
	const canonical = canonicalName(name);
	const known = KNOWN[canonical];
	if (known) {
		return { name: canonical, version, source: 'package.json', ...known };
	}
	if (!license) {
		return { name, version, source: 'package.json', ...UNKNOWN_LIB };
	}
	const classified = classifySpdx(license);
	return {
		name,
		version,
		source: 'package.json',
		license,
		spdx: license,
		...classified
	};
}

const SELLABLE_RANK: Record<Sellability, number> = { yes: 0, conditions: 1, unknown: 2, risk: 3 };

export function mergeLibraries(...groups: DetectedLibrary[][]): DetectedLibrary[] {
	const map = new Map<string, DetectedLibrary>();
	for (const group of groups) {
		for (const lib of group) {
			if (!map.has(lib.name)) map.set(lib.name, lib);
		}
	}
	return [...map.values()].sort((a, b) => SELLABLE_RANK[b.sellable] - SELLABLE_RANK[a.sellable]);
}

export function buildLicenseAudit(libraries: DetectedLibrary[]): LicenseAudit {
	if (libraries.length === 0) {
		return {
			libraries,
			sellable: 'yes',
			summary:
				'No third-party libraries detected in page assets — no external license obligations found.'
		};
	}

	const worst = libraries.reduce<Sellability>(
		(acc, lib) => (SELLABLE_RANK[lib.sellable] > SELLABLE_RANK[acc] ? lib.sellable : acc),
		'yes'
	);

	const count = (s: Sellability) => libraries.filter((l) => l.sellable === s).length;
	const total = libraries.length;
	const libs = (n: number) => `${n} ${n === 1 ? 'library' : 'libraries'}`;

	const summary =
		worst === 'risk'
			? `${count('risk')} of ${libs(total)} detected put commercial use at risk — resolve before charging money.`
			: worst === 'unknown'
				? `${count('unknown')} of ${libs(total)} detected have unverified licenses — check them before selling.`
				: worst === 'conditions'
					? `All ${libs(total)} detected allow selling — ${count('conditions')} with conditions to meet.`
					: `All ${libs(total)} detected permit commercial use. Nothing here blocks selling this product.`;

	return { libraries, sellable: worst, summary };
}

export function licenseCheckStatus(audit: LicenseAudit): CheckStatus {
	if (audit.sellable === 'risk') return 'fail';
	if (audit.sellable === 'yes') return 'pass';
	return 'warn';
}
