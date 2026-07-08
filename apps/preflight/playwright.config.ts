import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI
		? [
				['list'],
				['junit', { outputFile: 'test-results/playwright-junit.xml' }],
				['html', { open: 'never' }]
			]
		: 'list',
	use: {
		baseURL: 'http://localhost:4199',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run dev -- --port 4199',
		env: {
			...process.env,
			DEPLOYLINT_PLATFORM_PROXY_CONFIG: 'wrangler.local.jsonc'
		},
		url: 'http://localhost:4199',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
