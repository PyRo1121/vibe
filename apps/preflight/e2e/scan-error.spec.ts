import { test, expect } from '@playwright/test';

import { mockScanApi } from './helpers';

test.describe('scan error', () => {
	test('surfaces API errors without leaving the page', async ({ page }) => {
		await mockScanApi(page, 'error', 502);
		await page.goto('/');
		await page.getByPlaceholder('your-app.com or github.com/you/repo').fill('https://broken.test');
		await page.getByRole('button', { name: 'Audit target' }).click();

		await expect(page.getByRole('alert')).toContainText(/Could not reach that URL/i);
		await expect(
			page.getByRole('heading', { name: /Stop risky workflows before they reach deploy/i })
		).toBeVisible();
	});
});
