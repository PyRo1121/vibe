import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

test.describe('multi-page coverage', () => {
	test('shows pages scanned strip when report includes sub-pages', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/');
		await runMockScan(page);

		const strip = page.getByRole('status', { name: 'Pages scanned' });
		await expect(strip).toBeVisible();
		await expect(strip.getByText('Scanned 2 pages:')).toBeVisible();
		await expect(strip.getByText('Privacy', { exact: true })).toBeVisible();
		await expect(strip.getByText('/privacy')).toBeVisible();
	});

	test('hides strip for single-page reports', async ({ page }) => {
		await mockScanApi(page, {
			...mockScanReport,
			pagesScanned: [{ url: 'https://demo-app.test/', role: 'home', status: 200 }]
		});
		await page.goto('/');
		await runMockScan(page);

		await expect(page.getByText('Scanned 1 pages:')).not.toBeVisible();
	});
});
