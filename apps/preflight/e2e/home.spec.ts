import { test, expect } from '@playwright/test';

import { WORKSPACE_SETUP_BUTTON } from './helpers';

test.describe('home', () => {
	test('shows hero and CI workspace differentiators', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/project readiness before deploy/i);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/turn ci evidence into workspace-backed deploy gates/i
		);
		await expect(
			page.getByRole('heading', { name: /prove the project is ready before deploy/i })
		).toBeVisible();
		await expect(page.getByText('CI risk')).toBeVisible();
		await expect(page.getByText('Repo/license readiness')).toBeVisible();
		await expect(page.getByText('Deploy gate evidence')).toBeVisible();
		await expect(page.getByRole('link', { name: /Start workspace setup/i })).toHaveAttribute(
			'href',
			'#project-setup'
		);
		await expect(page.getByRole('link', { name: /Check workflow YAML/i }).first()).toBeVisible();
		await expect(page.getByText('Advisory PR report', { exact: true })).toBeVisible();
		await expect(page.getByText('Workspace loop')).toBeVisible();
		await expect(page.getByText('What the workspace keeps enforcing')).toBeVisible();
		await expect(page.getByText('Monitored projects')).toBeVisible();
		await expect(page.getByText('Install path')).toBeVisible();
		await expect(page.getByText('Workspace workflow')).toBeVisible();
		await expect(page.getByRole('link', { name: /Generate in workspace/i })).toHaveAttribute(
			'href',
			'./app#install'
		);
		await expect(page.getByText('DEPLOYLINT_PROJECT_ID')).toBeVisible();
		await expect(page.getByText('Block bad deploys in CI')).toBeVisible();
		await expect(page.getByText('Find deploy-path drift')).toBeVisible();
		await expect(page.getByRole('heading', { name: /Start workspace setup/i })).toBeVisible();
		await expect(page.getByText(/Prefill the logged-in workspace/i)).toBeVisible();
		await expect(page.getByLabel(/Project name/i)).toBeVisible();
		await expect(page.getByLabel(/GitHub repository/i)).toBeVisible();
		await expect(page.getByLabel(/Deploy target/i)).toBeVisible();
		await expect(page.getByRole('button', { name: WORKSPACE_SETUP_BUTTON })).toBeVisible();
		await expect(page.getByRole('button', { name: /Run advisory review/i })).toHaveCount(0);
		await expect(page.getByText('Project readiness audit')).toBeVisible();
		await expect(page.getByRole('link', { name: /Compare tools/i })).toBeVisible();
	});

	test('carries project profile into workspace setup', async ({ page }) => {
		await page.goto('/');

		await page.getByLabel(/Project name/i).fill('Acme control plane');
		await page.getByLabel(/GitHub repository/i).fill('https://github.com/acme/control-plane');
		await page.getByLabel(/Deploy target/i).fill('https://app.acme.test/');
		await page.getByRole('button', { name: WORKSPACE_SETUP_BUTTON }).click();

		await expect(page).toHaveURL(/\/login\?redirectTo=/);
		const redirected = new URL(page.url());
		const redirectTo = redirected.searchParams.get('redirectTo') ?? '';
		expect(redirectTo).toContain('/app?');
		expect(redirectTo).toContain('name=Acme+control+plane');
		expect(redirectTo).toContain('repo=https%3A%2F%2Fgithub.com%2Facme%2Fcontrol-plane');
		expect(redirectTo).toContain('deploy=https%3A%2F%2Fapp.acme.test%2F');
		expect(redirectTo).toContain('minScore=80');
	});
});
