import type { ResponseSecurityHeaders } from '$lib/scan/headers';

export const STRONG_HEADERS: ResponseSecurityHeaders = {
	hsts: 'max-age=31536000; includeSubDomains',
	csp: "default-src 'self'",
	xFrameOptions: 'DENY',
	xContentTypeOptions: 'nosniff',
	referrerPolicy: 'strict-origin-when-cross-origin',
	permissionsPolicy: 'camera=(), microphone=(), geolocation=()'
};
