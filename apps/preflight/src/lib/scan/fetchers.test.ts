import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	appHostname,
	buildScanDeps,
	createScanDeps,
	defaultDeps,
	readBoundedText,
	wrapSameZoneFetch
} from './fetchers';

type SiteFetch = typeof fetch;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('appHostname', () => {
	it('parses configured app URL', () => {
		expect(appHostname('https://deploylint.com/')).toBe('deploylint.com');
	});

	it('returns null for invalid URL', () => {
		expect(appHostname('not-a-url')).toBeNull();
	});

	it('returns null for missing or blank app URLs', () => {
		expect(appHostname(undefined)).toBeNull();
		expect(appHostname('   ')).toBeNull();
	});
});

describe('wrapSameZoneFetch', () => {
	it('routes same-host requests through the service binding', async () => {
		const self = { fetch: vi.fn<SiteFetch>(async () => new Response('ok', { status: 200 })) };
		const external = vi.fn<SiteFetch>(async () => new Response('external', { status: 200 }));
		const siteFetch = wrapSameZoneFetch(self as unknown as Fetcher, 'app.test', external);

		await siteFetch('https://app.test/privacy');
		expect(self.fetch).toHaveBeenCalledWith('https://preflight.internal/privacy', undefined);

		await siteFetch('https://other.test/page');
		expect(external).toHaveBeenCalled();
	});

	it('rewrites same-host Request objects while preserving method, body, and query', async () => {
		const self = { fetch: vi.fn<SiteFetch>(async () => new Response('ok', { status: 200 })) };
		const external = vi.fn<SiteFetch>(async () => new Response('external', { status: 200 }));
		const siteFetch = wrapSameZoneFetch(self as unknown as Fetcher, 'app.test', external);

		await siteFetch(
			new Request('https://app.test/api/events?source=client', {
				method: 'POST',
				body: 'payload',
				headers: { 'content-type': 'text/plain' }
			})
		);

		const internalRequest = self.fetch.mock.calls[0]?.[0] as Request;
		expect(internalRequest.url).toBe('https://preflight.internal/api/events?source=client');
		expect(internalRequest.method).toBe('POST');
		await expect(internalRequest.text()).resolves.toBe('payload');
		expect(external).not.toHaveBeenCalled();
	});

	it('rewrites same-host GET Request objects without forwarding a body', async () => {
		const self = { fetch: vi.fn<SiteFetch>(async () => new Response('ok', { status: 200 })) };
		const siteFetch = wrapSameZoneFetch(self as unknown as Fetcher, 'app.test');

		await siteFetch(new Request('https://app.test/health?verbose=1', { method: 'GET' }));

		const internalRequest = self.fetch.mock.calls[0]?.[0] as Request;
		expect(internalRequest.url).toBe('https://preflight.internal/health?verbose=1');
		expect(internalRequest.method).toBe('GET');
		await expect(internalRequest.text()).resolves.toBe('');
	});
});

describe('createScanDeps', () => {
	it('returns default deps without SELF binding', () => {
		expect(createScanDeps({ PUBLIC_APP_URL: 'https://app.test' } as Env)).toBe(defaultDeps);
	});

	it('routes configured app-host fetches through the SELF service binding', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<SiteFetch>(async () => Response.json({ Answer: [{ type: 1, data: '93.184.216.34' }] }))
		);
		const self = {
			fetch: vi.fn<SiteFetch>(async () => new Response('<html>ok</html>', { status: 200 }))
		};

		const deps = createScanDeps({
			PUBLIC_APP_URL: 'https://app.test',
			SELF: self as unknown as Fetcher
		} as Env);
		const result = await deps.fetchHtml(new URL('https://app.test/privacy'));

		expect(result.html).toBe('<html>ok</html>');
		expect(self.fetch).toHaveBeenCalledWith('https://preflight.internal/privacy', {
			signal: expect.any(AbortSignal),
			headers: {
				Accept: 'text/html,application/xhtml+xml',
				'User-Agent': expect.any(String)
			},
			redirect: 'manual'
		});
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

	it('returns script text under the cap and null for unreadable scripts', async () => {
		const deps = buildScanDeps(
			async (url) =>
				String(url).endsWith('/missing.js')
					? new Response('missing', { status: 404 })
					: new Response('console.log("ok")', { status: 200 }),
			async () => ['93.184.216.34'],
			{ maxScriptBytes: 100 }
		);

		await expect(deps.fetchText('https://example.com/app.js')).resolves.toBe('console.log("ok")');
		await expect(deps.fetchText('https://example.com/missing.js')).resolves.toBeNull();
		await expect(deps.fetchText('http://example.com/app.js')).resolves.toBeNull();
	});

	it('blocks redirects to resolved private addresses before fetching them', async () => {
		const siteFetch = vi.fn<SiteFetch>(async (url) => {
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

	it('fails HTML fetches after too many redirects', async () => {
		const deps = buildScanDeps(
			async () => new Response('', { status: 302, headers: { location: '/loop' } }),
			async () => ['93.184.216.34']
		);

		await expect(deps.fetchHtml(new URL('https://example.com'))).rejects.toThrow(
			'Too many redirects'
		);
	});

	it('falls back to GET for link checks when HEAD is inconclusive', async () => {
		const methods: string[] = [];
		const deps = buildScanDeps(
			async (_url, init) => {
				methods.push(init?.method ?? 'GET');
				return new Response('', { status: init?.method === 'HEAD' ? 500 : 403 });
			},
			async () => ['93.184.216.34']
		);

		await expect(deps.headOk('https://example.com/private')).resolves.toBe(true);
		expect(methods).toEqual(['HEAD', 'GET']);
	});

	it('passes link checks on successful HEAD and fails when fallback GET is a server error', async () => {
		const okDeps = buildScanDeps(
			async () => new Response(null, { status: 204 }),
			async () => ['93.184.216.34']
		);
		await expect(okDeps.headOk('https://example.com/up')).resolves.toBe(true);

		const methods: string[] = [];
		const failingDeps = buildScanDeps(
			async (_url, init) => {
				methods.push(init?.method ?? 'GET');
				return new Response('', { status: 500 });
			},
			async () => ['93.184.216.34']
		);

		await expect(failingDeps.headOk('https://example.com/down')).resolves.toBe(false);
		expect(methods).toEqual(['HEAD', 'GET']);
	});

	it('treats missing links and invalid URLs as failed link checks', async () => {
		const deps = buildScanDeps(
			async () => new Response('', { status: 404 }),
			async () => ['93.184.216.34']
		);

		await expect(deps.headOk('https://example.com/missing')).resolves.toBe(false);
		await expect(deps.headOk('not-a-url')).resolves.toBe(false);
	});

	it('falls back to GET for og:image probes when HEAD is rejected', async () => {
		const methods: string[] = [];
		let getBodyCanceled = false;
		const deps = buildScanDeps(
			async (_url, init) => {
				methods.push(init?.method ?? 'GET');
				if (init?.method === 'HEAD') {
					return new Response('', { status: 405 });
				}
				const body = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]));
					},
					cancel() {
						getBodyCanceled = true;
					}
				});
				return new Response(body, {
					status: 200,
					headers: { 'content-type': 'image/png' }
				});
			},
			async () => ['93.184.216.34']
		);

		const result = await deps.headProbe('https://example.com/og.png');

		expect(result).toEqual({ reachable: true, contentType: 'image/png', isImage: true });
		expect(methods).toEqual(['HEAD', 'GET']);
		expect(getBodyCanceled).toBe(true);
	});

	it('reports missing og:image probes without falling back to GET', async () => {
		const siteFetch = vi.fn<SiteFetch>(async () => new Response('', { status: 404 }));
		const deps = buildScanDeps(siteFetch, async () => ['93.184.216.34']);

		await expect(deps.headProbe('https://example.com/missing.png')).resolves.toEqual({
			reachable: false,
			isImage: null,
			contentType: null
		});
		expect(siteFetch).toHaveBeenCalledOnce();
	});

	it('uses successful HEAD responses for og:image probes', async () => {
		const deps = buildScanDeps(
			async () => new Response('', { status: 200, headers: { 'content-type': 'image/jpeg' } }),
			async () => ['93.184.216.34']
		);

		await expect(deps.headProbe('https://example.com/og.jpg')).resolves.toEqual({
			reachable: true,
			contentType: 'image/jpeg',
			isImage: true
		});
	});

	it('reports invalid og:image probe URLs as unreachable', async () => {
		const deps = buildScanDeps(
			async () => new Response('', { status: 200 }),
			async () => ['93.184.216.34']
		);

		await expect(deps.headProbe('http://example.com/og.jpg')).resolves.toEqual({
			reachable: false,
			isImage: null,
			contentType: null
		});
	});

	it('resolves TXT records through Cloudflare DNS and normalizes segmented records', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<SiteFetch>(async () =>
				Response.json({
					Answer: [
						{ type: 16, data: '"v=spf1 " "include:_spf.example.com ~all"' },
						{ type: 1, data: '93.184.216.34' }
					]
				})
			)
		);
		const deps = buildScanDeps(
			async () => new Response('ok'),
			async () => ['93.184.216.34']
		);

		await expect(deps.resolveTxt?.('example.com')).resolves.toEqual([
			'v=spf1 include:_spf.example.com ~all'
		]);
	});

	it('returns empty TXT answers when DNS lookup fails or returns non-OK', async () => {
		const fetchMock = vi
			.fn<SiteFetch>()
			.mockResolvedValueOnce(new Response('bad', { status: 500 }))
			.mockRejectedValueOnce(new Error('dns down'));
		vi.stubGlobal('fetch', fetchMock);
		const deps = buildScanDeps(
			async () => new Response('ok'),
			async () => ['93.184.216.34']
		);

		await expect(deps.resolveTxt?.('example.com')).resolves.toEqual([]);
		await expect(deps.resolveTxt?.('example.com')).resolves.toEqual([]);
	});
});
