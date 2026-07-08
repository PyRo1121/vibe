import { test, expect, type Page } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { DEPLOY_TARGET_BUTTON, mockScanApi, runMockScan } from './helpers';

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
	test('keeps the homepage scan workflow usable on a phone viewport', async ({ page }) => {
		await mockScanApi(page, mockScanReport);
		await page.goto('/');

		await expect(
			page.getByRole('heading', { name: /prove the project is ready before deploy/i })
		).toBeVisible();
		await expect(page.getByLabel(/Project name/i)).toBeVisible();
		await expect(page.getByLabel(/GitHub repository/i)).toBeVisible();
		await expect(page.getByLabel(/Deploy target/i)).toBeVisible();
		await expect(page.getByRole('button', { name: DEPLOY_TARGET_BUTTON })).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await runMockScan(page);

		await expect(page.getByText('Project readiness score')).toBeVisible();
		await expect(page.getByText('Revenue readiness', { exact: true }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});
});
