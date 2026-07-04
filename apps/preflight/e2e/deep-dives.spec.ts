import { test, expect } from '@playwright/test';
import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

test.describe('deep dives', () => {
	test('shows social preview deep dive with issues badge', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/');
		await runMockScan(page);

		await expect(page.getByRole('heading', { name: 'Deep dives' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Social preview', exact: true })).toBeVisible();
		await expect(page.getByText('1 issue')).toBeVisible();
	});
});
