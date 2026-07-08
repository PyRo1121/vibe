import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { DEPLOY_TARGET_BUTTON, mockScanApi, runMockScan } from './helpers';

test.describe('scan flow', () => {
	test('submits a URL and renders the verdict report', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/');
		await runMockScan(page);

		await expect(page.getByText('CONDITIONAL GO')).toBeVisible();
		await expect(page.getByText('Project readiness score')).toBeVisible();
		await expect(page.getByText('72', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('Revenue readiness', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('1 revenue blocker', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();
		await expect(page.getByText('Privacy policy', { exact: true }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy sample' })).toBeVisible();
	});

	test('submits deploy target when both repo and deploy target are present', async ({ page }) => {
		const submitted: unknown[] = [];
		await page.route('**/api/scan', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			submitted.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockScanReport)
			});
		});

		await page.goto('/');
		await page.getByLabel(/Project name/i).fill('Control plane');
		await page.getByLabel(/GitHub repository/i).fill('https://github.com/acme/control-plane');
		await page.getByLabel(/Deploy target/i).fill('https://app.acme.test');
		await page.getByRole('button', { name: DEPLOY_TARGET_BUTTON }).click();

		await expect(page.getByText('Deploy verdict')).toBeVisible({ timeout: 15_000 });
		expect(submitted).toEqual([{ url: 'https://app.acme.test' }]);
	});

	test('submits repository when no deploy target is provided', async ({ page }) => {
		const submitted: unknown[] = [];
		await page.route('**/api/scan', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			submitted.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockScanReport)
			});
		});

		await page.goto('/');
		await page.getByLabel(/GitHub repository/i).fill('github.com/acme/control-plane');
		await page.getByRole('button', { name: DEPLOY_TARGET_BUTTON }).click();

		await expect(page.getByText('Deploy verdict')).toBeVisible({ timeout: 15_000 });
		expect(submitted).toEqual([{ url: 'github.com/acme/control-plane' }]);
	});

	test('clears stored unlock state when the project target changes', async ({ page }) => {
		const submitted: unknown[] = [];
		await page.route('**/api/scan', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			submitted.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockScanReport)
			});
		});

		await page.goto('/');
		await page.evaluate(() => {
			sessionStorage.setItem('preflight_scan_url', 'https://old.example.com');
			sessionStorage.setItem('preflight_unlock_session', 'cs_old');
			sessionStorage.setItem('preflight_baseline_score', '62');
			sessionStorage.setItem('preflight_baseline_checks', '[]');
		});
		await page.getByLabel(/Deploy target/i).fill('https://new.example.com');
		await page.getByRole('button', { name: DEPLOY_TARGET_BUTTON }).click();

		await expect(page.getByText('Deploy verdict')).toBeVisible({ timeout: 15_000 });
		expect(submitted).toEqual([{ url: 'https://new.example.com' }]);
		await expect
			.poll(() =>
				page.evaluate(() => ({
					unlock: sessionStorage.getItem('preflight_unlock_session'),
					baselineScore: sessionStorage.getItem('preflight_baseline_score'),
					baselineChecks: sessionStorage.getItem('preflight_baseline_checks')
				}))
			)
			.toEqual({
				unlock: null,
				baselineScore: '72',
				baselineChecks: expect.any(String)
			});
	});
});
