import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

test.describe('multi-page coverage', () => {
	test('shows public surfaces reviewed strip when report includes sub-pages', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/review');
		await runMockScan(page);

		const strip = page.getByRole('status', { name: 'Public surfaces reviewed' });
		await expect(strip).toBeVisible();
		await expect(strip.getByText('Reviewed 2 public surfaces:')).toBeVisible();
		await expect(strip.getByText('Privacy', { exact: true })).toBeVisible();
		await expect(strip.getByText('/privacy')).toBeVisible();
	});

	test('hides strip for single-page reports', async ({ page }) => {
		await mockScanApi(page, {
			...mockScanReport,
			pagesScanned: [{ url: 'https://demo-app.test/', role: 'home', status: 200 }]
		});
		await page.goto('/review');
		await runMockScan(page);

		await expect(page.getByText('Reviewed 1 public surfaces:')).not.toBeVisible();
	});
});
