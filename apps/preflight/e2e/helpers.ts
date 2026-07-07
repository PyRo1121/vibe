import { expect, type Page } from '@playwright/test';

import type { ScanReport } from '../src/lib/scan/types';

export async function mockScanApi(page: Page, report: ScanReport | 'error', status = 200) {
	await page.route('**/api/scan', async (route) => {
		if (route.request().method() !== 'POST') {
			await route.continue();
			return;
		}
		if (report === 'error') {
			await route.fulfill({
				status,
				contentType: 'application/json',
				body: JSON.stringify({
					message: 'Could not reach that URL — check the spelling or try again later.'
				})
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(report)
		});
	});
}

export async function runMockScan(page: Page, url = 'https://demo-app.test') {
	await page.getByPlaceholder('your-app.com or github.com/you/repo').fill(url);
	await page.getByRole('button', { name: 'Audit target' }).click();
	await expect(page.getByText('Launch verdict')).toBeVisible({ timeout: 15_000 });
}
