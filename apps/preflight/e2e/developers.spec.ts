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
				name: /Advisory bootstrap workflow before workspace setup/i
			})
		).toBeVisible();
		await expect(page.getByRole('link', { name: /Generate workspace workflow/i })).toHaveAttribute(
			'href',
			'./app#install'
		);
		await expect(page.getByText('Do not copy documentation placeholder IDs')).toBeVisible();
		await expect(page.getByText('proj_demo_123')).toHaveCount(0);
		await expect(page.getByText('Advisory PR report')).toBeVisible();
		await expect(page.getByText('temporary advisory workflow')).toHaveCount(0);
		await expect(page.getByText('sample project IDs')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Switch to blocking mode' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Composite GitHub Action' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Open workspace setup' })).toBeVisible();
	});
});
