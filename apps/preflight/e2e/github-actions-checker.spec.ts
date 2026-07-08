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
      # actions/checkout v7
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      # actions/setup-node v6
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
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
      # actions/checkout v7
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      # actions/dependency-review-action v5.0.0
      - uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294

  codeql:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      # actions/checkout v7
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      # github/codeql-action v4
      - uses: github/codeql-action/init@1ad29ea4a422cce9a242a9fae469541dcd08addc
      - uses: github/codeql-action/analyze@1ad29ea4a422cce9a242a9fae469541dcd08addc

  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [verify, codeql]
    steps:
      - run: npm run deploy`;

test.describe('GitHub Actions checker', () => {
	test('scores risky and hardened workflows in-browser', async ({ page }) => {
		await page.goto('/tools/github-actions-security-checker');

		await expect(page.getByRole('heading', { name: /check workflow yaml/i })).toBeVisible();
		await expect(page.getByText('Risky', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'pull_request_target safety' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Immutable action pins' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'CodeQL scanning' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Dependency review' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Deploy dependencies' })).toBeVisible();

		await page.getByLabel('Workflow YAML').fill(hardenedWorkflow);

		await expect(page.getByText('Hardened', { exact: true })).toBeVisible();
		await expect(page.getByText('100', { exact: true })).toBeVisible();
		await expect(page.getByText('8 pass')).toBeVisible();
		await expect(page.getByText('0 fail')).toBeVisible();
		await expect(
			page.getByText(
				'Deploy-like GitHub Actions jobs wait for verify, security, or Deploylint jobs'
			)
		).toBeVisible();
	});
});
