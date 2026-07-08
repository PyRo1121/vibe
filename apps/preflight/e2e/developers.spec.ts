import { test, expect } from '@playwright/test';

test.describe('developers', () => {
	test('documents the advisory-first CI setup', async ({ page }) => {
		await page.goto('/developers');
		await expect(
			page.getByRole('heading', { name: /Add a deploy-risk report to every pull request/i })
		).toBeVisible();
		await expect(page.getByText('DEPLOYLINT_URL').first()).toBeVisible();
		await expect(
			page.getByRole('heading', {
				name: /Temporary advisory run before workspace setup/i
			})
		).toBeVisible();
		await expect(page.getByRole('link', { name: /Generate workspace workflow/i })).toHaveAttribute(
			'href',
			'./app#install'
		);
		await expect(page.getByText('Do not copy sample project IDs from documentation')).toBeVisible();
		await expect(page.getByText('proj_demo_123')).toHaveCount(0);
		await expect(page.getByText('Advisory PR report preview')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Switch to blocking mode' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Composite GitHub Action' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Build readiness evidence' })).toBeVisible();
	});
});
