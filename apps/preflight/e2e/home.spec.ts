import { test, expect } from '@playwright/test';

import { DEPLOY_TARGET_BUTTON } from './helpers';

test.describe('home', () => {
	test('shows hero and pre-scan differentiators', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/project readiness before deploy/i);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/review ci risk, repo hygiene, license and sell-rights evidence/i
		);
		await expect(
			page.getByRole('heading', { name: /prove the project is ready before deploy/i })
		).toBeVisible();
		await expect(page.getByRole('link', { name: /Check workflow YAML/i })).toBeVisible();
		await expect(page.getByText('Sample PR report')).toBeVisible();
		await expect(page.getByText('Subscription loop')).toBeVisible();
		await expect(page.getByText('What stays alive after the first check')).toBeVisible();
		await expect(page.getByText('Monitored projects')).toBeVisible();
		await expect(page.getByText('Install path')).toBeVisible();
		await expect(page.getByText('Copy into CI')).toBeVisible();
		await expect(page.getByText('Block bad deploys in CI')).toBeVisible();
		await expect(page.getByText('Find deploy-path drift')).toBeVisible();
		await expect(page.getByRole('button', { name: DEPLOY_TARGET_BUTTON })).toBeVisible();
		await expect(page.getByText('Project readiness audit')).toBeVisible();
		await expect(page.getByRole('link', { name: /See how we compare/i })).toBeVisible();
	});
});
