import { describe, expect, it } from 'vitest';

import { detectStack } from './stack';

const URL_PLAIN = new URL('https://example.com/');

describe('detectStack', () => {
	it('detects Next.js from __NEXT_DATA__', () => {
		const html = '<script id="__NEXT_DATA__" type="application/json">{}</script>';
		expect(detectStack(html, URL_PLAIN)).toContain('Next.js');
	});

	it('detects SvelteKit from immutable assets', () => {
		const html = '<link rel="modulepreload" href="/_app/immutable/entry/start.js">';
		expect(detectStack(html, URL_PLAIN)).toContain('SvelteKit');
	});

	it('detects WordPress and its generator without duplication', () => {
		const html =
			'<meta name="generator" content="WordPress 6.5"><link href="/wp-content/themes/x/style.css">';
		const stack = detectStack(html, URL_PLAIN);
		expect(stack).toContain('WordPress');
		expect(stack.filter((s) => s.toLowerCase().includes('wordpress'))).toHaveLength(1);
	});

	it('surfaces unknown generators like Hugo', () => {
		const html = '<meta name="generator" content="Hugo 0.121.0">';
		expect(detectStack(html, URL_PLAIN)).toContain('Hugo 0.121.0');
	});

	it('detects hosting from the final hostname', () => {
		expect(detectStack('<html></html>', new URL('https://demo.vercel.app/'))).toContain('Vercel');
		expect(detectStack('<html></html>', new URL('https://demo.pages.dev/'))).toContain(
			'Cloudflare Pages'
		);
	});

	it('detects high-signal launch services from script and API signatures', () => {
		const html = [
			'<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>',
			'<script src="https://assets.lemonsqueezy.com/lemon.js"></script>',
			'<script src="https://browser.sentry-cdn.com/8.0.0/bundle.min.js"></script>',
			'<script src="https://js.clerk.com/v4/clerk.browser.js"></script>',
			'<script>fetch("https://api.openai.com/v1/chat/completions")</script>'
		].join('');

		expect(detectStack(html, URL_PLAIN)).toEqual(
			expect.arrayContaining(['Paddle', 'Lemon Squeezy', 'Sentry', 'Clerk', 'OpenAI'])
		);
	});

	it('returns empty for a plain page with no signatures', () => {
		expect(detectStack('<html><body><h1>Hi</h1></body></html>', URL_PLAIN)).toEqual([]);
	});

	it('does not false-match loose words', () => {
		const html = '<p>We love Next.js and WordPress and Shopify as words in prose.</p>';
		expect(detectStack(html, URL_PLAIN)).toEqual([]);
	});
});
