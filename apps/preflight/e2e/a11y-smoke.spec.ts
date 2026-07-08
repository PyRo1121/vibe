import { test, expect } from '@playwright/test';

import { DEPLOY_TARGET_INPUT, WORKSPACE_SETUP_BUTTON } from './helpers';

test.describe('a11y smoke', () => {
	test('home page has landmarks, labels, and keyboard focusable workspace form', async ({
		page
	}) => {
		await page.goto('/');

		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
		await expect(page.getByRole('contentinfo')).toBeVisible();

		const input = page.getByPlaceholder(DEPLOY_TARGET_INPUT);
		await input.fill('https://example.test');
		await expect(page.getByRole('button', { name: WORKSPACE_SETUP_BUTTON })).toBeEnabled();
		await expect(page.getByRole('button', { name: /Run advisory review/i })).toHaveCount(0);
		await page.getByRole('button', { name: WORKSPACE_SETUP_BUTTON }).focus();
		await expect(page.getByRole('button', { name: WORKSPACE_SETUP_BUTTON })).toBeFocused();
	});
});
