import { UrlValidationError } from '$lib/scan/url-guard';
import { parseScanJsonBody, readJsonBody, rejectValidation } from '$lib/server/api';
import { describe, expect, it } from 'vitest';

describe('readJsonBody', () => {
	it('parses valid JSON within size limit', async () => {
		const body = JSON.stringify({ url: 'https://app.test' });
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'content-length': String(body.length)
			},
			body
		});

		await expect(readJsonBody(request)).resolves.toEqual({ url: 'https://app.test' });
	});

	it('rejects oversized bodies even without content-length', async () => {
		const body = 'x'.repeat(5000);
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			body
		});

		await expect(readJsonBody(request)).rejects.toBeInstanceOf(UrlValidationError);
	});

	it('rejects oversized bodies from content-length before reading the body', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: {
				'content-length': '5000'
			},
			body: '{}'
		});

		await expect(readJsonBody(request)).rejects.toThrow('Request body too large');
	});

	it('treats an empty request body as null', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST'
		});

		await expect(readJsonBody(request)).resolves.toBeNull();
	});

	it('rejects invalid JSON', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			body: '{not json'
		});

		await expect(readJsonBody(request)).rejects.toBeInstanceOf(UrlValidationError);
	});
});

describe('parseScanJsonBody', () => {
	it('parses and normalizes a valid scan request', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			body: JSON.stringify({
				url: '  https://app.test  ',
				unlockSessionId: 'cs_test_123',
				previousScore: 72.5
			})
		});

		await expect(parseScanJsonBody(request)).resolves.toEqual({
			url: 'https://app.test',
			unlockSessionId: 'cs_test_123',
			previousScore: 73
		});
	});

	it('turns URL validation failures into SvelteKit 400 errors', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			body: JSON.stringify({ url: 'https://127.0.0.1' })
		});

		await expect(parseScanJsonBody(request)).rejects.toMatchObject({
			status: 400,
			body: { message: 'That URL cannot be scanned' }
		});
	});
});

describe('rejectValidation', () => {
	it('rethrows non-validation errors unchanged', () => {
		const err = new Error('storage unavailable');

		expect(() => rejectValidation(err)).toThrow(err);
	});
});
