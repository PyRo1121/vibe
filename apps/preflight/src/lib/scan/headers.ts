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

export function hasClickjackProtection(headers: ResponseSecurityHeaders): boolean {
	if (headers.xFrameOptions?.trim()) return true;
	const csp = headers.csp?.toLowerCase() ?? '';
	return csp.includes('frame-ancestors');
}

export function hstsStatus(
	headers: ResponseSecurityHeaders,
	https: boolean
): 'pass' | 'warn' | 'fail' {
	if (!https) return 'fail';
	return headers.hsts?.trim() ? 'pass' : 'warn';
}

export function cspStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	return headers.csp?.trim() ? 'pass' : 'warn';
}

export function mimeSniffStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	const value = headers.xContentTypeOptions?.toLowerCase() ?? '';
	return value.includes('nosniff') ? 'pass' : 'warn';
}

export function clickjackStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	return hasClickjackProtection(headers) ? 'pass' : 'warn';
}

export function referrerPolicyStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	return headers.referrerPolicy?.trim() ? 'pass' : 'warn';
}

export function permissionsPolicyStatus(headers: ResponseSecurityHeaders): 'pass' | 'warn' {
	return headers.permissionsPolicy?.trim() ? 'pass' : 'warn';
}
