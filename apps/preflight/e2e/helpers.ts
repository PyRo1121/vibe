import { expect, type Page } from '@playwright/test';

import type { ScanReport } from '../src/lib/scan/types';

export const DEPLOY_TARGET_BUTTON = 'Preview CI advisory report';
export const WORKSPACE_SETUP_BUTTON = 'Continue to workspace setup';
export const ADVISORY_WORKFLOW_BUTTON = 'Generate advisory workflow';
export const DEPLOY_TARGET_INPUT = 'https://app.example.com';

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
	await page.getByPlaceholder(DEPLOY_TARGET_INPUT).fill(url);
	const reviewButton = page.getByRole('button', { name: DEPLOY_TARGET_BUTTON });
	await expect(reviewButton).toBeEnabled();
	await reviewButton.click();
	await expect(page.getByText('Gate readiness decision')).toBeVisible({ timeout: 15_000 });
}
