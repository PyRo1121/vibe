import type { ScanCheck } from '$lib/scan/types';
import type { CheckCtx } from '$lib/scan/checks/helpers';
import {
	clickjackStatus,
	cspStatus,
	hstsStatus,
	mimeSniffStatus,
	permissionsPolicyStatus,
	referrerPolicyStatus,
	type ResponseSecurityHeaders
} from '$lib/scan/headers';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

export function pushHeaderChecks(
	checks: ScanCheck[],
	headers: ResponseSecurityHeaders,
	https: boolean,
	ctx: CheckCtx
): void {
	if (!https) return;

	checks.push(
		makeCheck(
			'hsts-header',
			'security',
			'HSTS header',
			hstsStatus(headers, https),
			headers.hsts?.trim()
				? `Strict-Transport-Security: ${headers.hsts.split(';')[0]}`
				: 'Missing Strict-Transport-Security — first visit can be downgraded',
			fixPrompt('hsts-header', ctx)
		),
		makeCheck(
			'csp-header',
			'security',
			'Content-Security-Policy',
			cspStatus(headers),
			headers.csp?.trim()
				? 'CSP header present'
				: 'No CSP — XSS impact is higher if markup is ever injectable',
			fixPrompt('csp-header', ctx)
		),
		makeCheck(
			'clickjack-header',
			'security',
			'Clickjacking protection',
			clickjackStatus(headers),
			headers.xFrameOptions?.trim()
				? `X-Frame-Options: ${headers.xFrameOptions}`
				: headers.csp?.includes('frame-ancestors')
					? 'frame-ancestors set in CSP'
					: 'No X-Frame-Options or frame-ancestors',
			fixPrompt('clickjack-header', ctx)
		),
		makeCheck(
			'mime-sniff-header',
			'security',
			'MIME sniffing protection',
			mimeSniffStatus(headers),
			headers.xContentTypeOptions?.toLowerCase().includes('nosniff')
				? 'X-Content-Type-Options: nosniff'
				: 'Missing nosniff header',
			fixPrompt('mime-sniff-header', ctx)
		),
		makeCheck(
			'referrer-header',
			'security',
			'Referrer-Policy',
			referrerPolicyStatus(headers),
			headers.referrerPolicy?.trim()
				? `Referrer-Policy: ${headers.referrerPolicy}`
				: 'No Referrer-Policy header',
			fixPrompt('referrer-header', ctx)
		),
		makeCheck(
			'permissions-policy-header',
			'security',
			'Permissions-Policy',
			permissionsPolicyStatus(headers),
			headers.permissionsPolicy?.trim()
				? `Permissions-Policy: ${headers.permissionsPolicy.split(';')[0]}`
				: 'No Permissions-Policy — browsers may allow camera/mic/geo without explicit denial',
			fixPrompt('permissions-policy-header', ctx)
		)
	);
}
