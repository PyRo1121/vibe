import { test, expect } from '@playwright/test';

test.describe('home', () => {
	test('shows hero and pre-scan differentiators', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/ci hardening and builder devops tools/i);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/harden github actions, deploy gates, repo hygiene, and launch workflows/i
		);
		await expect(
			page.getByRole('heading', { name: /harden the path from pull request to production/i })
		).toBeVisible();
		await expect(page.getByText('GitHub Actions Security Checker').first()).toBeVisible();
		await expect(page.getByText('Block bad deploys in CI')).toBeVisible();
		await expect(page.getByText('Builder DevOps tools').first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Scan free' })).toBeVisible();
		await expect(page.getByText('Launch judgment')).toBeVisible();
		await expect(page.getByRole('link', { name: /See how we compare/i })).toBeVisible();
	});
});
