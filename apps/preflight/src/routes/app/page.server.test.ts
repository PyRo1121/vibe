import { describe, expect, it } from 'vitest';

import { load } from './+page.server';

async function loadApp(overrides: Partial<Parameters<typeof load>[0]> = {}) {
	return await load({
		locals: { session: null, user: null },
		platform: { env: { PUBLIC_APP_URL: 'https://deploylint.com' } },
		url: new URL('https://deploylint.com/app'),
		...overrides
	} as Parameters<typeof load>[0]);
}

describe('/app server load', () => {
	it('redirects anonymous users to login', async () => {
		await expect(loadApp()).rejects.toMatchObject({
			status: 303,
			location: '/login?redirectTo=%2Fapp'
		});
	});

	it('returns the authenticated user with the workspace data', async () => {
		const data = await loadApp({
			locals: {
				session: null,
				user: {
					id: 'user_123',
					name: 'Olen',
					email: 'olen@example.com',
					emailVerified: true,
					image: null,
					createdAt: new Date('2026-07-07T00:00:00.000Z'),
					updatedAt: new Date('2026-07-07T00:00:00.000Z')
				}
			}
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(pageData.user).toMatchObject({
			id: 'user_123',
			name: 'Olen',
			email: 'olen@example.com'
		});
		expect(pageData.workspace.ownerLabel).toBe("Olen's workspace");
	});
});
