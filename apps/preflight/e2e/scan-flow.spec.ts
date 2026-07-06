import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

test.describe('scan flow', () => {
	test('submits a URL and renders the verdict report', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/');
		await runMockScan(page);

		await expect(page.getByText('CONDITIONAL GO')).toBeVisible();
		await expect(page.getByText('Launch score')).toBeVisible();
		await expect(page.getByText('72', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('Payment readiness', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('1 revenue blocker', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();
		await expect(page.getByText('Privacy policy', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('Alpha access unlocked')).not.toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Fix everything in one paste' })
		).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy sample' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy prompt' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Start Solo - $9/mo' })).toHaveCount(2);
		await expect(page.getByText('Unlock to copy this fix')).toHaveCount(2);
	});
});
