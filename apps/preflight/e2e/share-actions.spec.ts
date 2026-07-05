import { test, expect } from '@playwright/test';

import { mockScanReport } from './fixtures';
import { mockScanApi, runMockScan } from './helpers';

test.describe('share actions', () => {
	test('copies share text from the report summary', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await mockScanApi(page, mockScanReport);
		await page.goto('/');
		await runMockScan(page);

		await page.getByRole('button', { name: 'Copy share text' }).click();
		await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();

		const clipboard = await page.evaluate(() => navigator.clipboard.readText());
		expect(clipboard).toContain('72/100');
		expect(clipboard).toContain('CONDITIONAL GO');
	});
});
