import { describe, expect, it } from 'vitest';
import { assertPublicHttpUrl, isPublicHttpUrl, UrlValidationError } from './url-guard';

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
