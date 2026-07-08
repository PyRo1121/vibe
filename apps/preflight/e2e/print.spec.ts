import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

test.describe('print', () => {
	test('hides chrome and keeps report content in print mode', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/');
		await runMockScan(page);

		await expect(page.getByRole('button', { name: 'Save PDF' })).toBeVisible();

		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('header')).toBeHidden();
		await expect(page.getByText('Gate readiness decision')).toBeVisible();
		await expect(page.getByText('Gate readiness evidence')).toBeVisible();
	});
});
