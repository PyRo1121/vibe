import { describe, expect, it } from 'vitest';

import { handleEventsPost } from './events-handler';

describe('handleEventsPost', () => {
	it('accepts valid funnel events', async () => {
		const res = await handleEventsPost(
			new Request('http://localhost/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event: 'unlock_click', verdict: 'no-go', score: 42 })
			})
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});

	it('rejects unknown events', async () => {
		await expect(
			handleEventsPost(
				new Request('http://localhost/api/events', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ event: 'page_view' })
				})
			)
		).rejects.toThrow('Unknown event');
	});

	it('treats client-aborted analytics events as no-content noise', async () => {
		const request = {
			headers: new Headers({ 'Content-Type': 'application/json' }),
			text: async () => {
				throw new Error('aborted');
			}
		} as unknown as Request;

		const res = await handleEventsPost(request);

		expect(res.status).toBe(204);
	});
});
