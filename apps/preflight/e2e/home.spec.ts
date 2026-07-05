import { test, expect } from '@playwright/test';

test.describe('home', () => {
	test('shows hero and pre-scan differentiators', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/payment readiness checker for ai-built saas/i);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/scan an ai-built saas before charging users\..*checkout, signed webhooks, entitlements, billing self-service/i
		);
		await expect(
			page.getByRole('heading', { name: /can this ai-built saas safely take money/i })
		).toBeVisible();
		await expect(
			page.getByText(/checkout, signed webhooks, entitlements, billing self-service/i)
		).toBeVisible();
		await expect(page.getByText(/90\+ checks/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Scan free' })).toBeVisible();
		await expect(page.getByText('Launch judgment')).toBeVisible();
		await expect(page.getByRole('link', { name: /See how we compare/i })).toBeVisible();
	});
});
