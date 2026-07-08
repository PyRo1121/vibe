import { fixPrompt } from '$lib/scan/prompts';
import type { ScanCheck } from '$lib/scan/types';

/** Homepage returned 4xx/5xx — skip content checks; error body is not the real site. */
export function isBlockedHomepageStatus(status: number): boolean {
	return status >= 400;
}

/** Verdict/banner copy for incomplete scans. No status = fetch failed entirely. */
export function blockedScanMessage(status?: number): string {
	if (status == null) {
		return 'Evidence limited — Deploylint could not read the deploy target. Content checks were skipped.';
	}
	if (status === 403) {
		return 'Evidence limited — HTTP 403. Deploylint could not read the deploy target; automated review was blocked.';
	}
	if (status === 401) {
		return 'Evidence limited — HTTP 401. The deploy target requires auth or blocked automated review.';
	}
	if (status >= 500) {
		return `Evidence limited — HTTP ${status}. The server errored; content checks were skipped.`;
	}
	return `Evidence limited — HTTP ${status}. Deploylint could not read the deploy target; content checks were skipped.`;
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
