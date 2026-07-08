import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockAssertPlausibleEventBudget,
	mockClientIp,
	mockHandleBillingPortalPost,
	mockHandleCheckoutPost,
	mockHandleEventsPost,
	mockHandleScanPost,
	mockPlausibleUpstreamScript,
	mockProxyPlausibleEvent,
	mockProxyPlausibleScript,
	mockRejectValidation
} = vi.hoisted(() => ({
	mockAssertPlausibleEventBudget:
		vi.fn<
			(
				kv: KVNamespace | undefined,
				clientIp: string,
				limiter: DurableObjectNamespace | undefined
			) => Promise<void>
		>(),
	mockClientIp: vi.fn<(request: Request) => string>(),
	mockHandleBillingPortalPost:
		vi.fn<(request: Request, env: Partial<Env> | undefined, origin: string) => Promise<Response>>(),
	mockHandleCheckoutPost:
		vi.fn<(request: Request, env: Partial<Env> | undefined, origin: string) => Promise<Response>>(),
	mockHandleEventsPost: vi.fn<(request: Request) => Promise<Response>>(),
	mockHandleScanPost:
		vi.fn<(request: Request, env: Partial<Env> | undefined) => Promise<Response>>(),
	mockPlausibleUpstreamScript: vi.fn<(env: Partial<Env> | undefined) => string>(),
	mockProxyPlausibleEvent: vi.fn<(request: Request) => Promise<Response>>(),
	mockProxyPlausibleScript: vi.fn<(upstream: string) => Promise<Response>>(),
	mockRejectValidation: vi.fn<(err: unknown) => Response>()
}));

vi.mock('$lib/server/api', () => ({
	rejectValidation: mockRejectValidation
}));

vi.mock('$lib/server/billing-portal-handler', () => ({
	handleBillingPortalPost: mockHandleBillingPortalPost
}));

vi.mock('$lib/server/checkout-handler', () => ({
	handleCheckoutPost: mockHandleCheckoutPost
}));

vi.mock('$lib/server/events-handler', () => ({
	handleEventsPost: mockHandleEventsPost
}));

vi.mock('$lib/server/plausible-proxy', () => ({
	plausibleUpstreamScript: mockPlausibleUpstreamScript,
	proxyPlausibleEvent: mockProxyPlausibleEvent,
	proxyPlausibleScript: mockProxyPlausibleScript
}));

vi.mock('$lib/server/rate-limit', () => ({
	clientIp: mockClientIp
}));

vi.mock('$lib/server/scan-handler', () => ({
	handleScanPost: mockHandleScanPost
}));

vi.mock('$lib/server/usage-budget', () => ({
	assertPlausibleEventBudget: mockAssertPlausibleEventBudget
}));

import { POST as billingPortalPost } from './api/billing/portal/+server';
import { POST as checkoutPost } from './api/checkout/+server';
import { POST as eventsPost } from './api/events/+server';
import { POST as scanPost } from './api/scan/+server';
import { GET as blockedGet } from './fixtures/blocked/+server';
import { GET as llmsGet } from './llms.txt/+server';
import { GET as robotsGet } from './robots.txt/+server';
import { POST as plausibleEventPost } from './s/event/+server';
import { GET as plausibleScriptGet } from './s/script.js/+server';
import { GET as securityGet } from './security.txt/+server';

beforeEach(() => {
	vi.clearAllMocks();
	mockAssertPlausibleEventBudget.mockResolvedValue(undefined);
	mockClientIp.mockReturnValue('203.0.113.10');
	mockHandleBillingPortalPost.mockResolvedValue(new Response('billing portal'));
	mockHandleCheckoutPost.mockResolvedValue(new Response('checkout'));
	mockHandleEventsPost.mockResolvedValue(new Response('event'));
	mockHandleScanPost.mockResolvedValue(new Response('scan'));
	mockPlausibleUpstreamScript.mockReturnValue('https://plausible.io/js/script.js');
	mockProxyPlausibleEvent.mockResolvedValue(new Response('proxied event'));
	mockProxyPlausibleScript.mockResolvedValue(new Response('proxied script'));
	mockRejectValidation.mockReturnValue(new Response('invalid', { status: 400 }));
});

function envPlatform(env: Partial<Env>) {
	return { env } as Parameters<typeof checkoutPost>[0]['platform'];
}

describe('API route entrypoints', () => {
	it('forwards checkout and billing portal requests to server handlers with the request origin', async () => {
		const env = { STRIPE_SECRET_KEY: 'sk_test_123' };
		const checkoutRequest = new Request('https://deploylint.com/api/checkout', { method: 'POST' });
		const checkoutResponse = await checkoutPost({
			request: checkoutRequest,
			platform: envPlatform(env),
			url: new URL('https://deploylint.com/api/checkout')
		} as Parameters<typeof checkoutPost>[0]);

		expect(await checkoutResponse.text()).toBe('checkout');
		expect(mockHandleCheckoutPost).toHaveBeenCalledWith(
			checkoutRequest,
			env,
			'https://deploylint.com'
		);

		const portalRequest = new Request('https://deploylint.com/api/billing/portal', {
			method: 'POST'
		});
		const portalResponse = await billingPortalPost({
			request: portalRequest,
			platform: envPlatform(env),
			url: new URL('https://deploylint.com/api/billing/portal')
		} as Parameters<typeof billingPortalPost>[0]);

		expect(await portalResponse.text()).toBe('billing portal');
		expect(mockHandleBillingPortalPost).toHaveBeenCalledWith(
			portalRequest,
			env,
			'https://deploylint.com'
		);
	});

	it('forwards scan requests with the Cloudflare env binding', async () => {
		const env = { PUBLIC_APP_URL: 'https://deploylint.com' };
		const request = new Request('https://deploylint.com/api/scan', { method: 'POST' });
		const response = await scanPost({
			request,
			platform: envPlatform(env)
		} as Parameters<typeof scanPost>[0]);

		expect(await response.text()).toBe('scan');
		expect(mockHandleScanPost).toHaveBeenCalledWith(request, env);
	});

	it('validates API events through the shared validation response', async () => {
		const request = new Request('https://deploylint.com/api/events', { method: 'POST' });

		expect(await (await eventsPost({ request } as Parameters<typeof eventsPost>[0])).text()).toBe(
			'event'
		);
		expect(mockHandleEventsPost).toHaveBeenCalledWith(request);

		const err = new Error('bad event');
		mockHandleEventsPost.mockRejectedValueOnce(err);
		const rejected = await eventsPost({ request } as Parameters<typeof eventsPost>[0]);

		expect(rejected.status).toBe(400);
		expect(mockRejectValidation).toHaveBeenCalledWith(err);
	});
});

describe('public utility route entrypoints', () => {
	it('serves crawler utility text routes with cacheable plain text', async () => {
		const llms = await llmsGet({} as Parameters<typeof llmsGet>[0]);
		expect(llms.headers.get('Content-Type')).toContain('text/plain');
		expect(llms.headers.get('Cache-Control')).toBe('public, max-age=300');
		expect(await llms.text()).toContain('Deploylint');

		const robots = await robotsGet({} as Parameters<typeof robotsGet>[0]);
		expect(robots.headers.get('Cache-Control')).toBe('public, max-age=3600');
		expect(await robots.text()).toContain('Sitemap: https://deploylint.com/sitemap.xml');
	});

	it('serves security.txt and blocked fixture route responses', async () => {
		const security = await securityGet({} as Parameters<typeof securityGet>[0]);
		expect(security.headers.get('Content-Type')).toContain('text/plain');
		expect(await security.text()).toContain('Contact:');

		const blocked = await blockedGet({} as Parameters<typeof blockedGet>[0]);
		expect(blocked.status).toBe(403);
		expect(blocked.headers.get('Cache-Control')).toBe('no-store');
		expect(await blocked.text()).toContain('Access denied');
	});

	it('proxies Plausible script and event routes through server helpers with budget checks', async () => {
		const env = { REPORTS: {} as KVNamespace, LIMITER: {} as DurableObjectNamespace };
		const script = await plausibleScriptGet({
			platform: envPlatform(env)
		} as Parameters<typeof plausibleScriptGet>[0]);

		expect(await script.text()).toBe('proxied script');
		expect(mockPlausibleUpstreamScript).toHaveBeenCalledWith(env);
		expect(mockProxyPlausibleScript).toHaveBeenCalledWith('https://plausible.io/js/script.js');

		const request = new Request('https://deploylint.com/s/event', { method: 'POST' });
		const event = await plausibleEventPost({
			request,
			platform: envPlatform(env)
		} as Parameters<typeof plausibleEventPost>[0]);

		expect(await event.text()).toBe('proxied event');
		expect(mockClientIp).toHaveBeenCalledWith(request);
		expect(mockAssertPlausibleEventBudget).toHaveBeenCalledWith(
			env.REPORTS,
			'203.0.113.10',
			env.LIMITER
		);
		expect(mockProxyPlausibleEvent).toHaveBeenCalledWith(request);
	});
});
