import type { ScanCheck } from '$lib/scan/types';
import type { ScanContext } from '$lib/scan/checks/context';
import type { CheckCtx } from '$lib/scan/checks/helpers';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

/** Response time, soft-404 handling, and email deliverability — parity with dedicated launch checkers. */
export function pushOperationalChecks(checks: ScanCheck[], scanCtx: ScanContext, ctx: CheckCtx): void {
	const ms = scanCtx.responseTimeMs;
	if (ms != null) {
		const seconds = (ms / 1000).toFixed(1);
		// Single sample from one region — never worse than warn.
		const status = ms < 1200 ? 'pass' : 'warn';
		checks.push(
			makeCheck(
				'response-time',
				'launch',
				'Response time',
				status,
				ms < 1200
					? `Homepage responded in ${ms}ms`
					: ms < 3000
						? `Slow first response (${ms}ms) — aim for under ~1 second`
						: `Very slow first response (${seconds}s) — visitors and crawlers may give up`,
				fixPrompt('response-time', { ...ctx, message: `${ms}ms` })
			)
		);
	}

	const nf = scanCtx.notFoundStatus;
	if (nf != null && (nf === 404 || nf === 410 || (nf >= 200 && nf < 300))) {
		const soft = nf >= 200 && nf < 300;
		checks.push(
			makeCheck(
				'not-found-page',
				'seo',
				'404 handling',
				soft ? 'warn' : 'pass',
				soft
					? `Missing pages return HTTP ${nf} (soft 404) — every typo'd or dead URL looks like a real page to Google and to users`
					: `Missing pages correctly return HTTP ${nf}`,
				fixPrompt('not-found-page', { ...ctx, message: `HTTP ${nf} for a missing path` })
			)
		);
	}

	const email = scanCtx.emailAuth;
	if (email) {
		const status = email.spf && email.dmarc ? 'pass' : 'warn';
		const message =
			email.spf && email.dmarc
				? `SPF and DMARC records found on ${email.domain}`
				: email.spf
					? `SPF found but no DMARC on ${email.domain} — Gmail and Outlook increasingly require both`
					: `No SPF or DMARC on ${email.domain} — password resets and receipts will land in spam`;
		checks.push(
			makeCheck('email-auth', 'launch', 'Email deliverability (SPF/DMARC)', status, message,
				fixPrompt('email-auth', { ...ctx, message })
			)
		);
	}

	const host = scanCtx.hostConsistency;
	if (host) {
		let status: ScanCheck['status'] = 'pass';
		let message: string;
		if (!host.resolves) {
			status = 'warn';
			message = `${host.altHost} does not resolve — anyone typing it gets an error instead of your site`;
		} else if (!host.sameSite) {
			status = 'warn';
			message = `${host.altHost} serves a different site instead of redirecting here`;
		} else {
			message = `${host.altHost} reaches this site`;
		}
		checks.push(
			makeCheck('host-consistency', 'seo', 'www / apex domain', status, message,
				fixPrompt('host-consistency', { ...ctx, message })
			)
		);
	}
}
