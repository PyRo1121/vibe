import { UrlValidationError } from '$lib/scan/url-guard';
import { readJsonBody } from '$lib/server/api';
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

	it('rejects invalid JSON', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			body: '{not json'
		});

		await expect(readJsonBody(request)).rejects.toBeInstanceOf(UrlValidationError);
	});
});
