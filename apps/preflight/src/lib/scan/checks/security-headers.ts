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
import type { ScanCheck } from '$lib/scan/types';

export function pushHeaderChecks(
	checks: ScanCheck[],
	headers: ResponseSecurityHeaders,
	https: boolean,
	ctx: CheckCtx
): void {
	if (!https) return;

	const hsts = hstsStatus(headers, https);
	const csp = cspStatus(headers);
	const clickjack = clickjackStatus(headers);
	const mimeSniff = mimeSniffStatus(headers);
	const referrer = referrerPolicyStatus(headers);
	const permissionsPolicy = permissionsPolicyStatus(headers);

	checks.push(
		makeCheck(
			'hsts-header',
			'security',
			'HSTS header',
			hsts,
			hsts === 'pass'
				? `Strict-Transport-Security: ${headers.hsts?.split(';')[0]}`
				: headers.hsts?.trim()
					? `Strict-Transport-Security is present but too weak: ${headers.hsts.split(';')[0]}`
					: 'Missing Strict-Transport-Security - first visit can be downgraded',
			fixPrompt('hsts-header', ctx)
		),
		makeCheck(
			'csp-header',
			'security',
			'Content-Security-Policy',
			csp,
			csp === 'pass'
				? 'CSP header present'
				: headers.csp?.trim()
					? 'CSP header is present but weak against script injection'
					: 'No CSP - XSS impact is higher if markup is ever injectable',
			fixPrompt('csp-header', ctx)
		),
		makeCheck(
			'clickjack-header',
			'security',
			'Clickjacking protection',
			clickjack,
			clickjack === 'pass' && headers.xFrameOptions?.trim()
				? `X-Frame-Options: ${headers.xFrameOptions}`
				: clickjack === 'pass' && headers.csp?.includes('frame-ancestors')
					? 'frame-ancestors set in CSP'
					: headers.xFrameOptions?.trim()
						? `Invalid X-Frame-Options: ${headers.xFrameOptions}`
						: headers.csp?.includes('frame-ancestors')
							? 'Invalid frame-ancestors directive in CSP'
							: 'No X-Frame-Options or frame-ancestors',
			fixPrompt('clickjack-header', ctx)
		),
		makeCheck(
			'mime-sniff-header',
			'security',
			'MIME sniffing protection',
			mimeSniff,
			mimeSniff === 'pass'
				? 'X-Content-Type-Options: nosniff'
				: headers.xContentTypeOptions?.trim()
					? `Invalid X-Content-Type-Options: ${headers.xContentTypeOptions}`
					: 'Missing nosniff header',
			fixPrompt('mime-sniff-header', ctx)
		),
		makeCheck(
			'referrer-header',
			'security',
			'Referrer-Policy',
			referrer,
			referrer === 'pass'
				? `Referrer-Policy: ${headers.referrerPolicy}`
				: headers.referrerPolicy?.trim()
					? `Weak Referrer-Policy: ${headers.referrerPolicy}`
					: 'No Referrer-Policy header',
			fixPrompt('referrer-header', ctx)
		),
		makeCheck(
			'permissions-policy-header',
			'security',
			'Permissions-Policy',
			permissionsPolicy,
			permissionsPolicy === 'pass'
				? `Permissions-Policy: ${headers.permissionsPolicy?.split(';')[0]}`
				: headers.permissionsPolicy?.trim()
					? 'Permissions-Policy is present but does not deny camera, microphone, and geolocation'
					: 'No Permissions-Policy - browsers may allow camera/mic/geo without explicit denial',
			fixPrompt('permissions-policy-header', ctx)
		)
	);
}
