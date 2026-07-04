import type { ScanReport } from '$lib/scan/types';
import { buildContentChecks, type ScanContext } from '$lib/scan/analyze';
import { buildBlockedHomepageChecks, isBlockedHomepageStatus } from '$lib/scan/coverage';
import { crawlPages, selectCrawlTargets } from '$lib/scan/crawl';
import { defaultDeps, type ScanDeps } from '$lib/scan/fetchers';
import { buildLicenseAudit, detectLibraries, licenseCheckStatus, mergeLibraries } from '$lib/scan/license';
import { extractLinks } from '$lib/scan/parse';
import {
	checkEmailAuth,
	checkHostConsistency,
	checkLinks,
	checkOgImageLive,
	probeNotFound,
	scanScripts
} from '$lib/scan/probes';
import { fixPrompt } from '$lib/scan/prompts';
import { buildReport, makeCheck } from '$lib/scan/score';
import { detectStack } from '$lib/scan/stack';
import { assertPublicHttpUrl } from '$lib/scan/url-guard';

/**
 * Site scan orchestrator: fetch the homepage, fan out every probe in
 * parallel, then hand the evidence to the check builders. Network access
 * lives in $lib/scan/fetchers, individual probes in $lib/scan/probes.
 */
export async function scanUrl(rawUrl: string, deps: ScanDeps = defaultDeps): Promise<ScanReport> {
	const startUrl = assertPublicHttpUrl(rawUrl);

	try {
		const fetchStart = Date.now();
		const { html, finalUrl, status, headers, redirectHops } = await deps.fetchHtml(startUrl);
		const responseTimeMs = Date.now() - fetchStart;

		if (isBlockedHomepageStatus(status)) {
			const checks = buildBlockedHomepageChecks(status, finalUrl);
			return buildReport(startUrl.href, finalUrl, checks, undefined, {
				scanCoverage: 'blocked',
				httpStatus: status
			});
		}

		const links = extractLinks(html, finalUrl);
		// One parallel fan-out — wall time is the slowest branch, not the sum.
		// Workers queues fetches past its connection limit, so this is safe.
		const [
			crawledPages,
			linkResult,
			{ ok: ogImageOk, probe: ogImageProbe },
			notFoundStatus,
			emailAuth,
			hostConsistency
		] = await Promise.all([
			crawlPages(selectCrawlTargets(links, finalUrl), deps.fetchHtml),
			checkLinks(links, finalUrl, deps.headOk, deps.fetchText),
			checkOgImageLive(html, finalUrl, deps.headProbe),
			probeNotFound(finalUrl, deps.fetchHtml),
			deps.resolveTxt ? checkEmailAuth(finalUrl.hostname, deps.resolveTxt) : Promise.resolve(null),
			checkHostConsistency(finalUrl, deps.fetchHtml)
		]);

		const scriptHtml = [html, ...crawledPages.map((p) => p.html).filter(Boolean)];
		const { secrets: scriptSecrets, licenseFindings } = await scanScripts(
			scriptHtml,
			finalUrl,
			deps.fetchText
		);

		const licenseAudit = buildLicenseAudit(
			mergeLibraries(
				detectLibraries(html, finalUrl),
				licenseFindings.filter((f) => f !== null)
			)
		);

		const scanCtx: ScanContext = {
			redirectHops,
			ogImage: ogImageProbe,
			robotsText: linkResult.robotsText,
			responseTimeMs,
			notFoundStatus,
			emailAuth,
			hostConsistency
		};
		const checks = buildContentChecks(
			html,
			finalUrl,
			status,
			linkResult,
			links,
			scriptSecrets,
			headers,
			ogImageOk,
			scanCtx,
			crawledPages
		);

		const flagged = licenseAudit.libraries.filter((l) => l.sellable !== 'yes');
		checks.push(
			makeCheck(
				'license-risk',
				'legal',
				'License & sell rights',
				licenseCheckStatus(licenseAudit),
				licenseAudit.summary,
				fixPrompt('license-risk', {
					url: finalUrl.href,
					message: flagged.map((l) => `${l.name} — ${l.license}: ${l.note}`).join('; ')
				})
			)
		);

		return buildReport(startUrl.href, finalUrl, checks, html, {
			ogImageOk,
			ogImageProbe,
			licenseAudit,
			stack: detectStack(html, finalUrl),
			pagesScanned: [
				{ url: finalUrl.href, role: 'home' as const, status },
				...crawledPages.map((p) => ({ url: p.url, role: p.role, status: p.status }))
			]
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not fetch URL';
		const checks = [
			makeCheck(
				'fetch',
				'launch',
				'Site reachable',
				'fail',
				message,
				fixPrompt('fetch', { url: startUrl.href, message })
			)
		];
		// Fetch never completed — same incomplete-coverage treatment as a 4xx/5xx homepage.
		return buildReport(startUrl.href, startUrl, checks, undefined, { scanCoverage: 'blocked' });
	}
}

export type { FetchHtmlResult, ScanDeps } from '$lib/scan/fetchers';
export { checkHostConsistency, extractSitemapLocs } from '$lib/scan/probes';
export { normalizeUrl } from '$lib/scan/parse';
export { assertPublicHttpUrl, isPublicHttpUrl } from '$lib/scan/url-guard';
