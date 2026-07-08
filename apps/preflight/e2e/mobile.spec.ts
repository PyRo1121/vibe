import { test, expect, type Page } from '@playwright/test';

import { WORKSPACE_SETUP_BUTTON } from './helpers';

test.use({
	viewport: { width: 390, height: 844 },
	isMobile: true
});

async function expectNoHorizontalOverflow(page: Page) {
	const viewportWidths = await page.evaluate(() => ({
		body: document.body.scrollWidth,
		document: document.documentElement.scrollWidth,
		viewport: document.documentElement.clientWidth
	}));

	expect(viewportWidths.body).toBeLessThanOrEqual(viewportWidths.viewport + 1);
	expect(viewportWidths.document).toBeLessThanOrEqual(viewportWidths.viewport + 1);
}

test.describe('mobile UX', () => {
	test('keeps the homepage workspace handoff usable on a phone viewport', async ({ page }) => {
		await page.goto('/');

		await expect(
			page.getByRole('heading', { name: /prove the project is ready before deploy/i })
		).toBeVisible();
		await expect(page.getByLabel(/Project name/i)).toBeVisible();
		await expect(page.getByLabel(/GitHub repository/i)).toBeVisible();
		await expect(page.getByLabel(/Deploy target/i)).toBeVisible();
		await expect(page.getByRole('button', { name: WORKSPACE_SETUP_BUTTON })).toBeVisible();
		await expect(page.getByRole('button', { name: /Run advisory review/i })).toHaveCount(0);
		await expectNoHorizontalOverflow(page);

		await page.getByLabel(/Project name/i).fill('Mobile project');
		await page.getByLabel(/GitHub repository/i).fill('https://github.com/acme/mobile-project');
		await page.getByLabel(/Deploy target/i).fill('https://mobile.acme.test/');
		await page.getByRole('button', { name: WORKSPACE_SETUP_BUTTON }).click();

		await expect(page).toHaveURL(/\/login\?redirectTo=/);
	});
});
