export const AUTH_ROUTE_PREFIX = '/api/auth';
const LOGIN_ROUTE = '/login';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function clean(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function isLocalUrl(appUrl: string): boolean {
	try {
		const url = new URL(appUrl);
		return LOCAL_HOSTS.has(url.hostname);
	} catch {
		return false;
	}
}

export function buildLoginRedirect(url: URL): string {
	if (url.pathname === LOGIN_ROUTE) return LOGIN_ROUTE;

	const redirectTo = `${url.pathname}${url.search}`;
	return `${LOGIN_ROUTE}?redirectTo=${encodeURIComponent(redirectTo)}`;
}

export function sanitizeRedirectTo(value: string | null | undefined): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return '/app';
	}
	if (value.startsWith(AUTH_ROUTE_PREFIX)) return '/app';
	return value;
}

export function resolveAuthFeatureFlags(env: Partial<Env> | undefined) {
	const emailDelivery = Boolean(clean(env?.RESEND_API_KEY) && clean(env?.RESEND_FROM_EMAIL));

	return {
		emailPassword: true,
		emailDelivery,
		emailSignup: emailDelivery,
		github: Boolean(clean(env?.GITHUB_CLIENT_ID) && clean(env?.GITHUB_CLIENT_SECRET))
	};
}

export function resolveAuthBaseUrl(env: Partial<Env> | undefined, fallback: string): string {
	return clean(env?.BETTER_AUTH_URL) ?? clean(env?.PUBLIC_APP_URL) ?? fallback;
}

export function resolveAuthSecret(env: Partial<Env> | undefined, appUrl: string): string | null {
	const explicit = clean(env?.BETTER_AUTH_SECRET);
	if (explicit) return explicit;
	if (isLocalUrl(appUrl)) return `dev-only-${new URL(appUrl).host}`;
	return null;
}
