import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

const checkoutUrl = 'https://checkout.stripe.test/session/e2e';
const portalUrl = 'https://billing.stripe.test/session/e2e';
const scanUrl = 'https://demo-app.test';

test.describe('billing flow', () => {
	test('starts Stripe Checkout from the locked report workspace offer', async ({ page }) => {
		const checkoutRequests: unknown[] = [];
		await mockScanApi(page, mockScanReport);
		await page.route('**/api/checkout', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			checkoutRequests.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ url: checkoutUrl })
			});
		});
		await page.route('https://checkout.stripe.test/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<title>Stripe checkout</title><h1>Stripe checkout</h1>'
			});
		});

		await page.goto('/');
		await runMockScan(page, scanUrl);
		await page.getByRole('button', { name: 'Start Solo - $9/mo' }).first().click();

		await expect(page).toHaveURL(checkoutUrl);
		expect(checkoutRequests).toEqual([{ url: scanUrl, plan: 'solo' }]);
	});

	test('opens Stripe billing portal from a restored paid unlock session', async ({ page }) => {
		const portalRequests: unknown[] = [];
		const unlockedReport = {
			...mockScanReport,
			unlocked: true,
			masterPrompt: 'Fix the deploy blockers, rerun Deploylint, then enable gate mode.'
		};
		await page.addInitScript((value) => {
			sessionStorage.setItem('preflight_scan_url', value);
		}, scanUrl);
		await mockScanApi(page, unlockedReport);
		await page.route('**/api/billing/portal', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			portalRequests.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ url: portalUrl })
			});
		});
		await page.route('https://billing.stripe.test/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<title>Stripe billing portal</title><h1>Stripe billing portal</h1>'
			});
		});

		await page.goto('/?checkout=success&session_id=cs_paid_e2e');
		await expect(page.getByRole('button', { name: 'Manage billing' })).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('button', { name: 'Manage billing' }).click();

		await expect(page).toHaveURL(portalUrl);
		expect(portalRequests).toEqual([{ url: scanUrl, unlockSessionId: 'cs_paid_e2e' }]);
	});
});
