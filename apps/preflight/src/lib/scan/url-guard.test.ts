import { describe, expect, it } from 'vitest';
import {
	assertPublicHttpUrl,
	assertPublicResolvedUrl,
	isPublicHttpUrl,
	UrlValidationError
} from './url-guard';

describe('assertPublicHttpUrl', () => {
	it('accepts public https domains', () => {
		expect(assertPublicHttpUrl('https://example.com').hostname).toBe('example.com');
		expect(assertPublicHttpUrl('myapp.dev').protocol).toBe('https:');
	});

	it('accepts bare domains after normalization', () => {
		expect(() => assertPublicHttpUrl('myapp.dev')).not.toThrow();
	});

	it('rejects http', () => {
		expect(() => assertPublicHttpUrl('http://example.com')).toThrow(UrlValidationError);
	});

	it('rejects invalid hostnames', () => {
		expect(() => assertPublicHttpUrl('not a url !!!')).toThrow();
	});

	it('rejects metadata and loopback targets', () => {
		expect(() => assertPublicHttpUrl('https://169.254.169.254')).toThrow();
		expect(() => assertPublicHttpUrl('https://127.0.0.1')).toThrow();
	});

	it('rejects localhost', () => {
		expect(isPublicHttpUrl('https://localhost')).toBe(false);
		expect(isPublicHttpUrl('https://app.localhost')).toBe(false);
	});

	it('rejects private IPv4 literals', () => {
		expect(isPublicHttpUrl('https://127.0.0.1')).toBe(false);
		expect(isPublicHttpUrl('https://10.0.0.1')).toBe(false);
		expect(isPublicHttpUrl('https://192.168.1.1')).toBe(false);
		expect(isPublicHttpUrl('https://169.254.169.254')).toBe(false);
	});

	it('rejects private IPv6 literals', () => {
		expect(isPublicHttpUrl('https://[::1]')).toBe(false);
		expect(isPublicHttpUrl('https://[fc00::1]')).toBe(false);
		expect(isPublicHttpUrl('https://[fd00::1]')).toBe(false);
		expect(isPublicHttpUrl('https://[fe80::1]')).toBe(false);
	});

	it('rejects credentials in URL', () => {
		expect(isPublicHttpUrl('https://user:pass@example.com')).toBe(false);
	});

	it('rejects CGNAT and benchmark ranges', () => {
		expect(isPublicHttpUrl('https://100.64.0.1')).toBe(false);
		expect(isPublicHttpUrl('https://198.18.0.1')).toBe(false);
	});

	it('rejects internal TLD suffixes', () => {
		expect(isPublicHttpUrl('https://app.internal')).toBe(false);
		expect(isPublicHttpUrl('https://db.local')).toBe(false);
	});
});

describe('assertPublicResolvedUrl', () => {
	it('rejects hostnames that resolve to private IPv4 addresses', async () => {
		await expect(
			assertPublicResolvedUrl(new URL('https://public-name.test'), async () => ['127.0.0.1'])
		).rejects.toThrow(UrlValidationError);
		await expect(
			assertPublicResolvedUrl(new URL('https://public-name.test'), async () => ['169.254.169.254'])
		).rejects.toThrow(UrlValidationError);
	});

	it('rejects hostnames that resolve to private IPv6 and mapped loopback addresses', async () => {
		for (const address of ['::1', 'fc00::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
			await expect(
				assertPublicResolvedUrl(new URL('https://public-name.test'), async () => [address])
			).rejects.toThrow(UrlValidationError);
		}
	});

	it('accepts public resolved addresses', async () => {
		await expect(
			assertPublicResolvedUrl(new URL('https://example.com'), async () => [
				'93.184.216.34',
				'2606:2800:220:1:248:1893:25c8:1946'
			])
		).resolves.toMatchObject({ hostname: 'example.com' });
	});
});
