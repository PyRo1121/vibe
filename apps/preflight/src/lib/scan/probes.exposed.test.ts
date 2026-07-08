import { describe, expect, it, vi } from 'vitest';

import {
	checkDkimDns,
	checkEmailAuth,
	checkHostConsistency,
	checkLinks,
	collectSitemapLocs,
	probeExposedPaths,
	probeHealthEndpoints
} from './probes';

type HeadOk = (url: string) => Promise<boolean>;
type FetchText = (url: string) => Promise<string | null>;

describe('probeExposedPaths', () => {
	it('flags .env when 200 with KEY= pattern', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.endsWith('/.env'));
		const fetchText = vi.fn<FetchText>(async (url) => {
			if (url.endsWith('/.env')) return 'DATABASE_URL=postgres://x\n';
			return null;
		});
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.env.exposed).toBe(true);
		expect(r.git.exposed).toBe(false);
	});

	it('passes when .env returns 404', async () => {
		const headOk = vi.fn<HeadOk>(async () => false);
		const fetchText = vi.fn<FetchText>(async () => null);
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.env.exposed).toBe(false);
	});

	it('flags .git/HEAD when ref: visible', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.includes('/.git/HEAD'));
		const fetchText = vi.fn<FetchText>(async () => 'ref: refs/heads/main\n');
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.git.exposed).toBe(true);
	});

	it('flags exposed backup archives, env backups, SQL dumps, and package manifests', async () => {
		const headOk = vi.fn<HeadOk>(async (url) =>
			['/backup.zip', '/.env.bak', '/package.json', '/db.sql'].some((path) => url.endsWith(path))
		);
		const fetchText = vi.fn<FetchText>(async (url) => {
			if (url.endsWith('/backup.zip')) return 'PK'.padEnd(128, 'x');
			if (url.endsWith('/.env.bak')) return 'PASSWORD=secret\n';
			if (url.endsWith('/package.json')) return '{"name":"public-app"}';
			if (url.endsWith('/db.sql')) return 'CREATE TABLE users (id integer);';
			return null;
		});

		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);

		expect(r.backup.exposed).toBe(true);
		expect(r.backup.url).toBe('https://app.example.com/backup.zip');
		expect(r.packageJson.exposed).toBe(true);
		expect(r.packageJson.url).toBe('https://app.example.com/package.json');
	});

	it('does not flag reachable sensitive-looking paths when bodies do not match proof patterns', async () => {
		const headOk = vi.fn<HeadOk>(async () => true);
		const fetchText = vi.fn<FetchText>(async (url) => {
			if (url.endsWith('/.env')) return '<html>SPA fallback</html>';
			if (url.endsWith('/.git/HEAD')) return '<html>Not found</html>';
			if (url.endsWith('/backup.zip')) return 'short';
			if (url.endsWith('/.env.bak')) return 'not configuration';
			if (url.endsWith('/package.json')) return '<html>App shell</html>';
			if (url.endsWith('/db.sql')) return 'select pricing from page copy';
			return null;
		});

		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);

		expect(r.env.exposed).toBe(false);
		expect(r.git.exposed).toBe(false);
		expect(r.backup.exposed).toBe(false);
		expect(r.packageJson.exposed).toBe(false);
	});
});

describe('probeHealthEndpoints', () => {
	it('finds first 2xx among common health paths', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.endsWith('/health'));
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(true);
		expect(r.path).toBe('/health');
	});

	it('returns not found when no path responds', async () => {
		const headOk = vi.fn<HeadOk>(async () => false);
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(false);
	});

	it('checks API health and status paths promised by the scan copy', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.endsWith('/api/health'));
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(true);
		expect(r.path).toBe('/api/health');
	});
});

describe('checkLinks', () => {
	it('dedupes same-origin sitemap directives and falls back to /security.txt', async () => {
		const finalUrl = new URL('https://app.example.com/');
		const headOk = vi.fn<HeadOk>(async (url) => {
			if (url.endsWith('/missing')) return false;
			return [
				'/a',
				'/robots.txt',
				'/sitemap.xml',
				'/sitemap-extra.xml',
				'/about',
				'/security.txt'
			].some((path) => url.endsWith(path));
		});
		const fetchText = vi.fn<FetchText>(async (url) => {
			if (url.endsWith('/robots.txt')) {
				return [
					'User-agent: *',
					'Sitemap: https://app.example.com/sitemap-extra.xml',
					'Sitemap: https://app.example.com/sitemap-extra.xml',
					'Sitemap: https://other.example.com/sitemap.xml'
				].join('\n');
			}
			if (url.endsWith('/sitemap.xml')) {
				return '<urlset><url><loc>https://app.example.com/about</loc></url></urlset>';
			}
			if (url.endsWith('/sitemap-extra.xml')) {
				return '<urlset><url><loc>https://app.example.com/about</loc></url><url><loc>https://app.example.com/docs</loc></url></urlset>';
			}
			if (url.endsWith('/llms.txt')) {
				return '# Deploylint\nThis file explains how agents should inspect the app.';
			}
			if (url.endsWith('/security.txt')) return 'Contact: mailto:security@app.example.com';
			return null;
		});

		const result = await checkLinks(
			[
				'https://app.example.com/a',
				'https://app.example.com/missing',
				'https://external.example.com/ignored'
			],
			finalUrl,
			headOk,
			fetchText
		);

		expect(result.checkedCount).toBe(2);
		expect(result.brokenCount).toBe(1);
		expect(result.robotsOk).toBe(true);
		expect(result.llmsTxtOk).toBe(true);
		expect(result.securityTxtOk).toBe(true);
		expect(result.sitemapOk).toBe(true);
		expect(result.sitemapLocs).toEqual([
			'https://app.example.com/about',
			'https://app.example.com/docs'
		]);
	});
});

describe('collectSitemapLocs', () => {
	it('follows same-origin sitemap indexes and skips invalid child entries', async () => {
		const finalUrl = new URL('https://app.example.com/');
		const indexXml = [
			'<sitemapindex>',
			'<sitemap><loc>https://app.example.com/sitemap-pages.xml</loc></sitemap>',
			'<sitemap><loc>https://other.example.com/sitemap.xml</loc></sitemap>',
			'<sitemap><loc>not a url</loc></sitemap>',
			'</sitemapindex>'
		].join('');
		const childXml = [
			'<urlset>',
			'<url><loc>https://app.example.com/about</loc></url>',
			'<url><loc>https://other.example.com/ignored</loc></url>',
			'<url><loc>https://app.example.com/pricing?a=1&amp;b=2</loc></url>',
			'</urlset>'
		].join('');

		const locs = await collectSitemapLocs(indexXml, finalUrl, async (url) =>
			url.endsWith('/sitemap-pages.xml') ? childXml : null
		);

		expect(locs).toEqual([
			'https://app.example.com/about',
			'https://app.example.com/pricing?a=1&b=2'
		]);
	});
});

describe('email DNS probes', () => {
	it('falls back from deep subdomains to the apex for SPF and DMARC', async () => {
		const result = await checkEmailAuth('app.staging.example.com', async (name) => {
			if (name === 'example.com') return ['v=spf1 include:_spf.example.com ~all'];
			if (name === '_dmarc.example.com') return ['v=DMARC1; p=none'];
			return [];
		});

		expect(result).toEqual({ spf: true, dmarc: true, domain: 'example.com' });
	});

	it('returns null instead of failing the scan when TXT resolution throws', async () => {
		await expect(
			checkEmailAuth('app.example.com', async () => {
				throw new Error('dns down');
			})
		).resolves.toBeNull();
	});

	it('finds DKIM selectors on the apex when a subdomain has no selector', async () => {
		const result = await checkDkimDns('mail.example.com', async (name) =>
			name === 'google._domainkey.example.com' ? ['k=rsa; p=MIIB'] : []
		);

		expect(result).toEqual({ dkim: true, selector: 'google', domain: 'example.com' });
	});

	it('returns a false DKIM result on the first candidate when no selector is found', async () => {
		await expect(checkDkimDns('www.example.com', async () => [])).resolves.toEqual({
			dkim: false,
			selector: null,
			domain: 'example.com'
		});
	});
});

describe('checkHostConsistency', () => {
	it('skips deep subdomains that have no obvious apex/www sibling', async () => {
		await expect(
			checkHostConsistency(new URL('https://api.staging.example.com/'), async (url) => ({
				html: '',
				finalUrl: url,
				status: 200,
				headers: {
					hsts: null,
					csp: null,
					xFrameOptions: null,
					xContentTypeOptions: null,
					referrerPolicy: null,
					permissionsPolicy: null
				},
				redirectHops: 0
			}))
		).resolves.toBeNull();
	});
});
