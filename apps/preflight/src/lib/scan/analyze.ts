import type { ScanCheck } from '$lib/scan/types';
import type { CrawledPage } from '$lib/scan/crawl';
import type { LinkCheckResult, ScanContext } from '$lib/scan/checks/context';
import { tierFromCount } from '$lib/scan/checks/helpers';
import { pushMetaChecks } from '$lib/scan/checks/meta';
import { pushLaunchSignalChecks } from '$lib/scan/checks/launch-signals';
import { pushHeaderChecks } from '$lib/scan/checks/security-headers';
import { pushStackChecks } from '$lib/scan/checks/stack-services';
import { pushCompetitiveChecks, sitemapCheck } from '$lib/scan/checks/competitive';
import { pushOperationalChecks } from '$lib/scan/checks/operational';
import { pushA11yDepthChecks } from '$lib/scan/checks/a11y-depth';
import { pushPerfStaticChecks } from '$lib/scan/checks/perf-static';
import { pushSeoDepthChecks } from '$lib/scan/checks/seo-depth';
import { pushSecurityDepthChecks } from '$lib/scan/checks/security-depth';
import { pushAiReadinessChecks } from '$lib/scan/checks/ai-readiness';
import { pushConversionChecks } from '$lib/scan/checks/conversion';
import { pushTrustChecks } from '$lib/scan/checks/trust';
import { pushDeploymentHygieneChecks } from '$lib/scan/checks/deployment-hygiene';
import { hasMixedContent, parsePageMeta, findSecrets } from '$lib/scan/parse';
import type { ResponseSecurityHeaders } from '$lib/scan/headers';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

export type { LinkCheckResult, OgImageProbe, ScanContext } from '$lib/scan/checks/context';

/**
 * Orchestrates every content-based check for a fetched homepage. Individual
 * check groups live in $lib/scan/checks/* — this module only sequences them
 * and owns the handful of top-level checks (reachability, HTTPS, secrets,
 * link health).
 */
export function buildContentChecks(
	html: string,
	finalUrl: URL,
	status: number,
	linkResult: LinkCheckResult,
	links: string[],
	scriptSecrets: string[] = [],
	securityHeaders: ResponseSecurityHeaders = {
		hsts: null,
		csp: null,
		xFrameOptions: null,
		xContentTypeOptions: null,
		referrerPolicy: null
	},
	ogImageOk: boolean | null = null,
	scanCtx: ScanContext = {
		redirectHops: 0,
		ogImage: { reachable: null, isImage: null, contentType: null },
		robotsText: null
	},
	crawledPages: CrawledPage[] = []
): ScanCheck[] {
	const checks: ScanCheck[] = [];
	const ctx = { url: finalUrl.href };
	const meta = parsePageMeta(html, finalUrl, links);
	const https = finalUrl.protocol === 'https:';

	checks.push(
		makeCheck(
			'reachable',
			'launch',
			'Site reachable',
			status >= 200 && status < 400 ? 'pass' : 'fail',
			`HTTP ${status} at ${finalUrl.href}`,
			fixPrompt('reachable', { ...ctx, message: `HTTP ${status}` })
		),
		makeCheck(
			'https',
			'security',
			'HTTPS',
			https ? 'pass' : 'fail',
			https ? 'Served over HTTPS' : 'Site not on HTTPS',
			fixPrompt('https', ctx)
		)
	);

	if (https) {
		const mixedContent = hasMixedContent(html);
		checks.push(
			makeCheck(
				'mixed-content',
				'security',
				'Mixed content hints',
				mixedContent ? 'warn' : 'pass',
				mixedContent
					? 'Found http:// asset URLs in HTML on an HTTPS page'
					: 'No obvious http:// asset URLs in HTML',
				fixPrompt('mixed-content', ctx)
			)
		);
	}

	pushMetaChecks(checks, meta, ctx, crawledPages);
	pushLaunchSignalChecks(checks, meta, finalUrl, ctx, ogImageOk);
	pushHeaderChecks(checks, securityHeaders, https, ctx);
	pushSecretsCheck(checks, html, scriptSecrets, crawledPages, ctx);
	pushStackChecks(checks, meta, html, ctx, crawledPages);
	pushCompetitiveChecks(checks, html, ctx, linkResult, scanCtx, ogImageOk, crawledPages);
	pushOperationalChecks(checks, scanCtx, ctx);
	pushA11yDepthChecks(checks, html, ctx);
	pushPerfStaticChecks(checks, html, ctx);
	pushSeoDepthChecks(checks, html, finalUrl, ctx, crawledPages);
	pushSecurityDepthChecks(checks, html, finalUrl, ctx);
	pushAiReadinessChecks(checks, html, scanCtx.robotsText, ctx);
	pushConversionChecks(checks, html, ctx);
	pushTrustChecks(checks, html, ctx);
	if (scanCtx.exposedPaths && scanCtx.healthEndpoint && scanCtx.debugSignals) {
		pushDeploymentHygieneChecks(
			checks,
			html,
			meta,
			scanCtx.exposedPaths,
			scanCtx.healthEndpoint,
			scanCtx.debugSignals,
			ctx
		);
	}
	pushLinkHealthChecks(checks, linkResult, ctx);

	return checks;
}

function pushSecretsCheck(
	checks: ScanCheck[],
	html: string,
	scriptSecrets: string[],
	crawledPages: CrawledPage[],
	ctx: { url: string }
): void {
	const htmlSecrets = findSecrets(html);
	const pageSecrets = crawledPages.flatMap((p) => (p.html ? findSecrets(p.html) : []));
	const secretsFound = [...new Set([...htmlSecrets, ...scriptSecrets, ...pageSecrets])];
	const fromJs = scriptSecrets.length > 0;
	checks.push(
		makeCheck(
			'secrets',
			'security',
			'Exposed secrets',
			secretsFound.length === 0 ? 'pass' : 'fail',
			secretsFound.length === 0
				? 'No obvious secret patterns in HTML, sampled JS, or source maps'
				: `Possible: ${secretsFound.join(', ')}${fromJs ? ' (includes sampled JS/source maps)' : ''}`,
			fixPrompt('secrets', { ...ctx, message: secretsFound.join(', ') })
		)
	);
}

function pushLinkHealthChecks(
	checks: ScanCheck[],
	linkResult: LinkCheckResult,
	ctx: { url: string }
): void {
	const { brokenCount, checkedCount, robotsOk, sitemapOk } = linkResult;
	// Every sampled link failing while the homepage loaded fine is almost always
	// rate limiting or bot protection, not a site with zero working links.
	const allFailed = checkedCount >= 5 && brokenCount === checkedCount;
	checks.push(
		makeCheck(
			'links',
			'launch',
			'Broken same-origin links',
			allFailed ? 'warn' : tierFromCount(brokenCount),
			brokenCount === 0
				? `Checked ${checkedCount} internal links`
				: allFailed
					? `All ${checkedCount} sampled links failed — likely rate limiting or bot protection; spot-check them manually`
					: `${brokenCount} of ${checkedCount} sampled links failed`,
			fixPrompt('links', { ...ctx, message: `${brokenCount} broken` })
		),
		makeCheck(
			'robots',
			'seo',
			'robots.txt',
			robotsOk ? 'pass' : 'warn',
			robotsOk ? 'robots.txt responds' : 'No robots.txt (optional but helpful)',
			fixPrompt('robots', ctx)
		),
		sitemapCheck(sitemapOk, linkResult.sitemapSample ?? null, ctx)
	);
}
