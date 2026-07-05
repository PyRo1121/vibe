import { describe, expect, it, vi } from 'vitest';
import {
	appHostname,
	buildScanDeps,
	createScanDeps,
	defaultDeps,
	readBoundedText,
	wrapSameZoneFetch
} from './fetchers';

describe('appHostname', () => {
	it('parses configured app URL', () => {
		expect(appHostname('https://deploylint.com/')).toBe('deploylint.com');
	});

	it('returns null for invalid URL', () => {
		expect(appHostname('not-a-url')).toBeNull();
	});
});

describe('wrapSameZoneFetch', () => {
	it('routes same-host requests through the service binding', async () => {
		const self = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) };
		const external = vi.fn(async () => new Response('external', { status: 200 }));
		const siteFetch = wrapSameZoneFetch(self as unknown as Fetcher, 'app.test', external);

		await siteFetch('https://app.test/privacy');
		expect(self.fetch).toHaveBeenCalledWith('https://preflight.internal/privacy', undefined);

		await siteFetch('https://other.test/page');
		expect(external).toHaveBeenCalled();
	});
});

describe('createScanDeps', () => {
	it('returns default deps without SELF binding', () => {
		expect(createScanDeps({ PUBLIC_APP_URL: 'https://app.test' } as Env)).toBe(defaultDeps);
	});
});

describe('readBoundedText', () => {
	it('caps large response bodies and cancels the reader', async () => {
		let canceled = false;
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('abcdef'));
				controller.enqueue(encoder.encode('ghijkl'));
			},
			cancel() {
				canceled = true;
			}
		});

		const result = await readBoundedText(new Response(stream), 8);

		expect(result).toEqual({ text: 'abcdefgh', truncated: true });
		expect(canceled).toBe(true);
	});
});

describe('buildScanDeps', () => {
	it('returns capped HTML without reading unlimited bodies', async () => {
		const deps = buildScanDeps(
			async () => new Response('abcdef', { status: 200 }),
			async () => ['93.184.216.34'],
			{ maxHtmlBytes: 4 }
		);

		const result = await deps.fetchHtml(new URL('https://example.com'));

		expect(result.html).toBe('abcd');
		expect(result.status).toBe(200);
	});

	it('returns null for script bodies over the cap', async () => {
		const deps = buildScanDeps(
			async () => new Response('abcdef', { status: 200 }),
			async () => ['93.184.216.34'],
			{ maxScriptBytes: 4 }
		);

		await expect(deps.fetchText('https://example.com/app.js')).resolves.toBeNull();
	});

	it('blocks redirects to resolved private addresses before fetching them', async () => {
		const siteFetch = vi.fn(async (url: RequestInfo | URL) => {
			const href = String(url);
			if (href === 'https://example.com/') {
				return new Response('', {
					status: 302,
					headers: { location: 'https://internal.example/secret' }
				});
			}
			return new Response('secret', { status: 200 });
		});
		const deps = buildScanDeps(siteFetch, async (hostname) =>
			hostname === 'internal.example' ? ['127.0.0.1'] : ['93.184.216.34']
		);

		await expect(deps.fetchHtml(new URL('https://example.com'))).rejects.toThrow(
			'That URL cannot be scanned'
		);
		expect(siteFetch).toHaveBeenCalledTimes(1);
	});
});
