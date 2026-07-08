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

	it('preserves workspace draft query params through login redirect', async () => {
		await expect(
			loadApp({
				url: new URL(
					'https://deploylint.com/app?name=Acme&repo=github.com%2Facme%2Fapp&deploy=https%3A%2F%2Fapp.acme.com'
				)
			})
		).rejects.toMatchObject({
			status: 303,
			location:
				'/login?redirectTo=%2Fapp%3Fname%3DAcme%26repo%3Dgithub.com%252Facme%252Fapp%26deploy%3Dhttps%253A%252F%252Fapp.acme.com'
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
		expect(pageData.activation.nextAction).toMatchObject({
			id: 'workflow',
			ctaLabel: 'Copy workflow'
		});
		expect(pageData.activation.progress).toEqual({
			completed: 1,
			total: 4,
			percentage: 25
		});
		expect(pageData.gatePolicy).toMatchObject({
			checkName: 'deploylint',
			mode: 'advisory',
			minScore: 80,
			enforcementLabel: 'Advisory only'
		});
	});

	it('uses project setup query params as the workspace draft', async () => {
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
			},
			url: new URL(
				'https://deploylint.com/app?name=Acme&repo=https%3A%2F%2Fgithub.com%2Facme%2Fapp&deploy=https%3A%2F%2Fapp.acme.com%2F&minScore=92'
			)
		});

		const pageData = data as Exclude<Awaited<ReturnType<typeof load>>, void>;
		const project = pageData.workspace.projects[0];

		expect(project).toMatchObject({
			name: 'Acme',
			repoLabel: 'github.com/acme/app',
			deployUrl: 'https://app.acme.com',
			minScore: 92
		});
		expect(pageData.projectDraftApplied).toBe(true);
		expect(pageData.advisoryWorkflow).toContain('DEPLOYLINT_URL: https://app.acme.com');
		expect(pageData.advisoryWorkflow).toContain("DEPLOYLINT_MIN_SCORE: '92'");
	});
});
