import { test, expect } from '@playwright/test';

test.describe('developers', () => {
	test('documents the advisory-first CI setup', async ({ page }) => {
		await page.goto('/developers');
		await expect(
			page.getByRole('heading', { name: /Deploylint CI report for pull requests/i })
		).toBeVisible();
		await expect(page.getByText('DEPLOYLINT_URL').first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Advisory workflow' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Switch to blocking mode' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Composite GitHub Action' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to scan' })).toBeVisible();
	});
});
