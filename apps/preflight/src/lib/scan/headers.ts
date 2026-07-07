export interface ResponseSecurityHeaders {
	hsts: string | null;
	csp: string | null;
	xFrameOptions: string | null;
	xContentTypeOptions: string | null;
	referrerPolicy: string | null;
	permissionsPolicy: string | null;
}

export function pickSecurityHeaders(res: Response): ResponseSecurityHeaders {
	return {
		hsts: res.headers.get('strict-transport-security'),
		csp: res.headers.get('content-security-policy'),
		xFrameOptions: res.headers.get('x-frame-options'),
		xContentTypeOptions: res.headers.get('x-content-type-options'),
		referrerPolicy: res.headers.get('referrer-policy'),
		permissionsPolicy: res.headers.get('permissions-policy')
	};
}

const MIN_HSTS_MAX_AGE_SECONDS = 15_552_000; // 180 days.
const SAFE_REFERRER_POLICIES = new Set([
	'no-referrer',
	'same-origin',
	'strict-origin',
	'strict-origin-when-cross-origin'
]);
const REQUIRED_DENIED_PERMISSIONS = ['camera', 'microphone', 'geolocation'];

function hasClickjackProtection(headers: ResponseSecurityHeaders): boolean {
	const xFrameOptions = headers.xFrameOptions?.trim().toLowerCase();
	if (xFrameOptions === 'deny' || xFrameOptions === 'sameorigin') return true;

	const frameAncestors = directiveValue(headers.csp, 'frame-ancestors');
	if (!frameAncestors) return false;

	const tokens = frameAncestors.toLowerCase().split(/\s+/).filter(Boolean);
	return tokens.length > 0 && !tokens.includes('*');
}

export function hstsStatus(
	headers: ResponseSecurityHeaders,
	https: boolean
): 'pass' | 'warn' | 'fail' {
	if (!https) return 'fail';
	const maxAge = headers.hsts?.match(/(?:^|;)\s*max-age\s*=\s*(\d+)/i)?.[1];
	return maxAge && Number(maxAge) >= MIN_HSTS_MAX_AGE_SECONDS ? 'pass' : 'warn';
}

export function cspStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	const csp = headers.csp?.trim();
	if (!csp) return 'warn';

	const hasScriptBoundary = Boolean(
		directiveValue(csp, 'default-src') ?? directiveValue(csp, 'script-src')
	);
	if (!hasScriptBoundary) return 'warn';

	for (const directive of ['default-src', 'script-src']) {
		const value = directiveValue(csp, directive);
		if (!value) continue;
		const tokens = value.toLowerCase().split(/\s+/).filter(Boolean);
		if (tokens.includes('*') || tokens.includes("'unsafe-inline'")) return 'warn';
	}

	return 'pass';
}

export function mimeSniffStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	const value = headers.xContentTypeOptions?.trim().toLowerCase() ?? '';
	return value === 'nosniff' ? 'pass' : 'warn';
}

export function clickjackStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	return hasClickjackProtection(headers) ? 'pass' : 'warn';
}

export function referrerPolicyStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	const policies = headers.referrerPolicy
		?.split(',')
		.map((policy) => policy.trim().toLowerCase())
		.filter(Boolean);
	if (!policies?.length) return 'warn';
	return SAFE_REFERRER_POLICIES.has(policies.at(-1) ?? '') ? 'pass' : 'warn';
}

export function permissionsPolicyStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	const permissions = headers.permissionsPolicy?.trim();
	if (!permissions) return 'warn';

	return REQUIRED_DENIED_PERMISSIONS.every((feature) =>
		new RegExp(`(?:^|[,;]\\s*)${feature}\\s*=\\s*\\(\\s*\\)`, 'i').test(permissions)
	)
		? 'pass'
		: 'warn';
}

function directiveValue(csp: string | null | undefined, directiveName: string): string | null {
	const directive = csp
		?.split(';')
		.map((part) => part.trim())
		.find((part) => part.toLowerCase().startsWith(`${directiveName.toLowerCase()} `));
	return directive?.slice(directiveName.length).trim() || null;
}
