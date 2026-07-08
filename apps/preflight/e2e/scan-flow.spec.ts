import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

test.describe('scan flow', () => {
	test('submits a URL and renders the verdict report', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/');
		await runMockScan(page);

		await expect(page.getByText('CONDITIONAL GO')).toBeVisible();
		await expect(page.getByText('Deploy risk score')).toBeVisible();
		await expect(page.getByText('72', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('Payment readiness', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('1 payment blocker', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();
		await expect(page.getByText('Privacy policy', { exact: true }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy sample' })).toBeVisible();
	});
});
