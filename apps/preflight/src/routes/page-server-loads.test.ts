import { describe, expect, it } from 'vitest';

import { load as homeLoad } from './+page.server';
import { csr as checksCsr, load as checksLoad } from './checks/+page.server';
import { csr as compareCsr, load as compareLoad } from './compare/+page.server';
import { csr as developersCsr, load as developersLoad } from './developers/+page.server';
import { load as loginLoad } from './login/+page.server';
import { load as reviewLoad } from './review/+page.server';
import { load as toolsLoad } from './tools/+page.server';
import { load as workflowCheckerLoad } from './tools/github-actions-security-checker/+page.server';

function pageUrl(path: string) {
	return new URL(`https://preview.deploylint.test${path}`);
}

describe('public route server loads', () => {
	it('keeps the home route as a static workspace handoff', () => {
		const data = homeLoad({
			url: pageUrl('/?checkout=success&billing=portal&session_id=cs_test_123'),
			platform: {
				env: {
					PUBLIC_APP_URL: 'https://deploylint.com'
				}
			}
		} as Parameters<typeof homeLoad>[0]);

		expect(data).toEqual({
			appUrl: 'https://deploylint.com'
		});
	});

	it('returns checkout state, canonical app URL, and alpha unlock state for the review route', () => {
		const data = reviewLoad({
			url: pageUrl('/review?checkout=success&billing=portal&session_id=cs_test_123'),
			platform: {
				env: {
					DEPLOYLINT_ALPHA_FREE_UNLOCK: 'true',
					PUBLIC_APP_URL: 'https://deploylint.com'
				}
			}
		} as Parameters<typeof reviewLoad>[0]);

		expect(data).toEqual({
			alphaFreeUnlock: true,
			checkout: 'success',
			billing: 'portal',
			sessionId: 'cs_test_123',
			appUrl: 'https://deploylint.com'
		});
	});

	it('falls back to the request origin for unauthenticated public surfaces', () => {
		expect(
			checksLoad({
				url: pageUrl('/checks')
			} as Parameters<typeof checksLoad>[0])
		).toEqual({ appUrl: 'https://preview.deploylint.test' });
		expect(
			toolsLoad({
				url: pageUrl('/tools')
			} as Parameters<typeof toolsLoad>[0])
		).toEqual({ appUrl: 'https://preview.deploylint.test' });
		expect(
			workflowCheckerLoad({
				url: pageUrl('/tools/github-actions-security-checker')
			} as Parameters<typeof workflowCheckerLoad>[0])
		).toEqual({ appUrl: 'https://preview.deploylint.test' });
	});

	it('uses configured canonical URLs for static SEO surfaces and disables client routing where expected', () => {
		const env = { PUBLIC_APP_URL: 'https://deploylint.com' };

		expect(checksCsr).toBe(false);
		expect(compareCsr).toBe(false);
		expect(developersCsr).toBe(false);
		expect(
			checksLoad({
				url: pageUrl('/checks'),
				platform: { env }
			} as Parameters<typeof checksLoad>[0])
		).toEqual({ appUrl: 'https://deploylint.com' });
		expect(
			compareLoad({
				url: pageUrl('/compare'),
				platform: { env }
			} as Parameters<typeof compareLoad>[0])
		).toEqual({ appUrl: 'https://deploylint.com' });
		expect(
			developersLoad({
				url: pageUrl('/developers'),
				platform: { env }
			} as Parameters<typeof developersLoad>[0])
		).toEqual({ appUrl: 'https://deploylint.com' });
	});
});

describe('/login server load', () => {
	it('sanitizes redirect targets and exposes the enabled auth methods', () => {
		const data = loginLoad({
			locals: { user: null },
			platform: {
				env: {
					RESEND_API_KEY: 're_test',
					RESEND_FROM_EMAIL: 'hello@deploylint.com'
				}
			},
			url: pageUrl('/login?redirectTo=/app%3Ftarget%3Dhttps%253A%252F%252Fexample.com')
		} as Parameters<typeof loginLoad>[0]);

		expect(data).toEqual({
			redirectTo: '/app?target=https%3A%2F%2Fexample.com',
			auth: {
				emailPassword: true,
				emailDelivery: true,
				github: false
			}
		});

		expect(
			loginLoad({
				locals: { user: null },
				url: pageUrl('/login?redirectTo=https://evil.test')
			} as Parameters<typeof loginLoad>[0])
		).toMatchObject({ redirectTo: '/app' });
	});

	it('redirects authenticated users to the sanitized return path', () => {
		expect(() =>
			loginLoad({
				locals: { user: { id: 'user_123' } },
				url: pageUrl('/login?redirectTo=/checks')
			} as Parameters<typeof loginLoad>[0])
		).toThrow(
			expect.objectContaining({
				status: 303,
				location: '/checks'
			})
		);
	});
});
