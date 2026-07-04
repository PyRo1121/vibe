import type { ScanCheck } from '$lib/scan/types';
import { fixPrompt } from '$lib/scan/prompts';

/** Homepage returned 4xx/5xx — skip content checks; error body is not the real site. */
export function isBlockedHomepageStatus(status: number): boolean {
	return status >= 400;
}

/** Verdict/banner copy for incomplete scans. No status = fetch failed entirely. */
export function blockedScanMessage(status?: number): string {
	if (status == null) {
		return 'Scan incomplete — the homepage could not be fetched. Content checks were skipped.';
	}
	if (status === 403) {
		return 'Scan incomplete — HTTP 403. The site likely blocked our scanner; checks below were skipped.';
	}
	if (status === 401) {
		return 'Scan incomplete — HTTP 401. The homepage requires auth or blocked our scanner.';
	}
	if (status >= 500) {
		return `Scan incomplete — HTTP ${status}. The server errored; content checks were skipped.`;
	}
	return `Scan incomplete — HTTP ${status}. We could not read the real homepage; content checks were skipped.`;
}

export function buildBlockedHomepageChecks(status: number, finalUrl: URL): ScanCheck[] {
	return [
		{
			id: 'reachable',
			category: 'launch',
			title: 'Site reachable',
			status: 'fail',
			message: `HTTP ${status} at ${finalUrl.href}`,
			fixPrompt: fixPrompt('reachable', { url: finalUrl.href, message: `HTTP ${status}` })
		},
		{
			id: 'https',
			category: 'security',
			title: 'HTTPS',
			status: finalUrl.protocol === 'https:' ? 'pass' : 'fail',
			message: finalUrl.protocol === 'https:' ? 'Served over HTTPS' : 'Site not on HTTPS',
			fixPrompt: fixPrompt('https', { url: finalUrl.href })
		}
	];
}
