import { test, expect } from '@playwright/test';

import {
	ADVISORY_WORKFLOW_BUTTON,
	DEPLOY_TARGET_BUTTON,
	DEPLOY_TARGET_INPUT,
	mockScanApi
} from './helpers';

test.describe('review error', () => {
	test('surfaces API errors without leaving the page', async ({ page }) => {
		await mockScanApi(page, 'error', 502);
		await page.goto('/review');
		await page.getByPlaceholder(DEPLOY_TARGET_INPUT).fill('https://broken.test');
		await page.getByRole('button', { name: DEPLOY_TARGET_BUTTON }).click();

		await expect(page.getByRole('alert')).toContainText(/Could not reach that URL/i);
		await expect(
			page.getByRole('heading', {
				name: /Generate CI-ready evidence before enabling the gate/i
			})
		).toBeVisible();
	});

	test('offers advisory workflow setup when shared preview capacity is full', async ({ page }) => {
		await page.route('**/api/scan', async (route) => {
			if (route.request().method() !== 'POST') {
				await route.continue();
				return;
			}

			await route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({
					code: 'daily_scan_capacity_reached',
					message:
						'Daily scan capacity reached - try again after midnight UTC. Deploylint stays on Cloudflare Free tier.',
					retryAt: '2026-07-09T00:00:00.000Z'
				})
			});
		});

		await page.goto('/review');
		await page.getByPlaceholder(DEPLOY_TARGET_INPUT).fill('https://capacity.test');
		await page.getByRole('button', { name: DEPLOY_TARGET_BUTTON }).click();

		await expect(page.getByRole('alert')).toContainText('Shared review capacity is full');
		await expect(page.getByRole('alert')).toContainText(
			'You can still generate the advisory workflow now'
		);
		await expect(
			page.getByRole('alert').getByRole('button', { name: ADVISORY_WORKFLOW_BUTTON })
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'View CI setup' })).toHaveAttribute(
			'href',
			'/developers'
		);
	});
});
