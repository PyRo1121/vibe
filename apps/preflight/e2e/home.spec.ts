import { test, expect } from '@playwright/test';

test.describe('home', () => {
	test('shows hero and pre-scan differentiators', async ({ page }) => {
		await page.goto('/');
		await expect(
			page.getByRole('heading', { name: /Should you post this URL today/i })
		).toBeVisible();
		await expect(page.getByText(/60\+ checks/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Scan free' })).toBeVisible();
		await expect(page.getByText('Launch judgment')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Compare tools →' })).toBeVisible();
	});
});
