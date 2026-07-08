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

		await page.goto('/review');
		await runMockScan(page, scanUrl);
		await page.getByRole('button', { name: 'Start Solo - $9/mo' }).first().click();

		await expect(page).toHaveURL(checkoutUrl);
		expect(checkoutRequests).toEqual([{ url: scanUrl, plan: 'solo' }]);
	});

	test('keeps checkout recoverable when Stripe session creation fails', async ({ page }) => {
		const checkoutRequests: unknown[] = [];
		await mockScanApi(page, mockScanReport);
		await page.route('**/api/checkout', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			checkoutRequests.push(route.request().postDataJSON());
			await route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Checkout temporarily unavailable' })
			});
		});

		await page.goto('/review');
		await runMockScan(page, scanUrl);
		await page.getByRole('button', { name: 'Start Solo - $9/mo' }).first().click();

		await expect(page).toHaveURL('/review');
		await expect(page.getByRole('alert')).toContainText('Checkout temporarily unavailable');
		await expect(page.getByRole('button', { name: 'Start Solo - $9/mo' }).first()).toBeEnabled();
		expect(checkoutRequests).toEqual([{ url: scanUrl, plan: 'solo' }]);
	});

	test('opens Stripe billing portal from a restored paid unlock session', async ({ page }) => {
		const scanRequests: unknown[] = [];
		const portalRequests: unknown[] = [];
		const unlockedReport = {
			...mockScanReport,
			unlocked: true,
			masterPrompt: 'Fix the deploy blockers, rerun Deploylint, then enable gate mode.'
		};
		await page.addInitScript((value) => {
			sessionStorage.setItem('preflight_scan_url', value);
		}, scanUrl);
		await page.route('**/api/scan', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			scanRequests.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(unlockedReport)
			});
		});
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

		await page.goto('/review?checkout=success&session_id=cs_paid_e2e');
		const manageBilling = page.getByRole('button', { name: 'Manage billing' });
		await expect(manageBilling).toBeVisible({ timeout: 15_000 });
		await expect.poll(() => new URL(page.url()).search).toBe('');
		expect(scanRequests).toEqual([{ url: scanUrl, unlockSessionId: 'cs_paid_e2e' }]);
		await manageBilling.click();

		await expect(page).toHaveURL(portalUrl);
		expect(portalRequests).toEqual([{ url: scanUrl, unlockSessionId: 'cs_paid_e2e' }]);
	});

	test('keeps billing management recoverable when portal creation fails', async ({ page }) => {
		const unlockedReport = {
			...mockScanReport,
			unlocked: true,
			masterPrompt: 'Fix the deploy blockers, rerun Deploylint, then enable gate mode.'
		};
		await page.addInitScript((value) => {
			sessionStorage.setItem('preflight_scan_url', value);
		}, scanUrl);
		await page.route('**/api/scan', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(unlockedReport)
			});
		});
		await page.route('**/api/billing/portal', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			await route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Billing portal temporarily unavailable' })
			});
		});

		await page.goto('/review?checkout=success&session_id=cs_paid_e2e');
		const manageBilling = page.getByRole('button', { name: 'Manage billing' });
		await expect(manageBilling).toBeVisible({ timeout: 15_000 });
		await manageBilling.click();

		await expect(page).toHaveURL('/review');
		await expect(page.getByRole('alert')).toContainText('Billing portal temporarily unavailable');
		await expect(manageBilling).toBeEnabled();
	});

	test('verifies fixes with paid checkout session and previous score context', async ({ page }) => {
		const scanRequests: unknown[] = [];
		const unlockedReport = {
			...mockScanReport,
			unlocked: true,
			masterPrompt: 'Fix the deploy blockers, rerun Deploylint, then enable gate mode.'
		};
		const verifiedReport = {
			...unlockedReport,
			score: 88,
			previousScore: 72,
			scoreDelta: 16,
			scanDiff: {
				fixed: ['Privacy policy'],
				regressed: []
			}
		};
		const scanResponses = [unlockedReport, verifiedReport];
		await page.addInitScript((value) => {
			sessionStorage.setItem('preflight_scan_url', value);
		}, scanUrl);
		await page.route('**/api/scan', async (route) => {
			if (route.request().method() !== 'POST') return route.continue();
			scanRequests.push(route.request().postDataJSON());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(scanResponses.shift() ?? verifiedReport)
			});
		});

		await page.goto('/review?checkout=success&session_id=cs_paid_e2e');
		await expect(page.getByRole('button', { name: 'Manage billing' })).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('button', { name: 'Verify fixes' }).click();

		await expect(page.getByText(/Verified: 72.*88.*\+16/)).toBeVisible();
		await expect(page.getByText('Fixed since last review: Privacy policy')).toBeVisible();
		expect(scanRequests).toEqual([
			{ url: scanUrl, unlockSessionId: 'cs_paid_e2e' },
			{ url: scanUrl, unlockSessionId: 'cs_paid_e2e', previousScore: 72 }
		]);
	});
});
