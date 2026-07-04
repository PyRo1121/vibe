import { test, expect } from '@playwright/test';

test('home hub renders hero and game grid', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Every TCG/i })).toBeVisible();
	await expect(page.getByRole('link', { name: /Magic: The Gathering/i })).toBeVisible();
});

test('main navigation is accessible', async ({ page }) => {
	await page.goto('/');
	const nav = page.getByRole('navigation', { name: 'Main navigation' });
	await expect(nav).toBeVisible();
	await expect(nav.getByRole('link', { name: 'MTG' })).toBeVisible();
});

test('skip link targets main content', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Skip to content' }).focus();
	await expect(page.locator('#main')).toBeAttached();
});
