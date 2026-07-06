import { expect, test } from '@playwright/test';

const hardenedWorkflow = `name: CI hardening gate

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build

  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4`;

test.describe('GitHub Actions checker', () => {
	test('scores risky and hardened workflows in-browser', async ({ page }) => {
		await page.goto('/tools/github-actions-security-checker');

		await expect(page.getByRole('heading', { name: /check workflow yaml/i })).toBeVisible();
		await expect(page.getByText('Risky', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'pull_request_target safety' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Dependency review' })).toBeVisible();

		await page.getByLabel('Workflow YAML').fill(hardenedWorkflow);

		await expect(page.getByText('Hardened', { exact: true })).toBeVisible();
		await expect(page.getByText('100', { exact: true })).toBeVisible();
		await expect(page.getByText('5 pass')).toBeVisible();
		await expect(page.getByText('0 fail')).toBeVisible();
	});
});
