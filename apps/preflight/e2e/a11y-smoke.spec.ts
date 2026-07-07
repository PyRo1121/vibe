import { test, expect } from '@playwright/test';

test.describe('a11y smoke', () => {
	test('home page has landmarks, labels, and keyboard focusable scan form', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
		await expect(page.getByRole('contentinfo')).toBeVisible();

		const input = page.getByPlaceholder('your-app.com or github.com/you/repo');
		await expect(input).toHaveAttribute('required', '');
		await input.fill('https://example.test');
		await expect(page.getByRole('button', { name: 'Audit target' })).toBeEnabled();
		await page.getByRole('button', { name: 'Audit target' }).focus();
		await expect(page.getByRole('button', { name: 'Audit target' })).toBeFocused();
	});
});
