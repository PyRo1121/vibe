import { describe, expect, it, vi } from 'vitest';

import { handle } from './hooks.server';

describe('server handle hook', () => {
	it('delegates every request to SvelteKit resolve', async () => {
		const event = { url: new URL('https://vault.test/') };
		const response = new Response('ok');
		const resolve = vi.fn<(event: unknown) => Promise<Response>>(async () => response);

		await expect(handle({ event, resolve } as never)).resolves.toBe(response);
		expect(resolve).toHaveBeenCalledWith(event);
	});
});
