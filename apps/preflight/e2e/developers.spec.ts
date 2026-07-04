import { test, expect } from '@playwright/test';

test.describe('developers', () => {
	test('documents the CI gate setup', async ({ page }) => {
		await page.goto('/developers');
		await expect(page.getByRole('heading', { name: /Deploy gate for vibe-coded apps/i })).toBeVisible();
		await expect(page.getByText('PREFLIGHT_GATE_URL').first()).toBeVisible();
		await expect(page.getByText('GitHub Action (recommended)')).toBeVisible();
		await expect(page.getByRole('link', { name: '← Back to scan' })).toBeVisible();
	});
});
