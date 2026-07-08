import { test, expect } from '@playwright/test';

import { DEPLOY_TARGET_BUTTON } from './helpers';

test.describe('home', () => {
	test('shows hero and pre-scan differentiators', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/ci hardening for fast builders/i);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/find risky github actions permissions, missing quality gates, and deploy blockers/i
		);
		await expect(
			page.getByRole('heading', { name: /stop risky workflows before they reach deploy/i })
		).toBeVisible();
		await expect(page.getByRole('link', { name: /Check workflow YAML/i })).toBeVisible();
		await expect(page.getByText('Sample PR report')).toBeVisible();
		await expect(page.getByText('Install path')).toBeVisible();
		await expect(page.getByText('Copy into CI')).toBeVisible();
		await expect(page.getByText('Block bad deploys in CI')).toBeVisible();
		await expect(page.getByText('Find deploy-path drift')).toBeVisible();
		await expect(page.getByRole('button', { name: DEPLOY_TARGET_BUTTON })).toBeVisible();
		await expect(page.getByText('Deploy target audit')).toBeVisible();
		await expect(page.getByRole('link', { name: /See how we compare/i })).toBeVisible();
	});
});
