import { test, expect } from '@playwright/test';

import { DEPLOY_TARGET_BUTTON, DEPLOY_TARGET_INPUT } from './helpers';

test.describe('a11y smoke', () => {
	test('home page has landmarks, labels, and keyboard focusable scan form', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
		await expect(page.getByRole('contentinfo')).toBeVisible();

		const input = page.getByPlaceholder(DEPLOY_TARGET_INPUT);
		await expect(input).toHaveAttribute('required', '');
		await input.fill('https://example.test');
		await expect(page.getByRole('button', { name: DEPLOY_TARGET_BUTTON })).toBeEnabled();
		await page.getByRole('button', { name: DEPLOY_TARGET_BUTTON }).focus();
		await expect(page.getByRole('button', { name: DEPLOY_TARGET_BUTTON })).toBeFocused();
	});
});
