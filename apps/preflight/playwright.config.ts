import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: true,
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
		baseURL: 'http://localhost:4299',
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
		video: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run dev -- --port 4299',
		env: {
			...process.env,
			DEPLOYLINT_PLATFORM_PROXY_CONFIG: 'wrangler.e2e.jsonc'
		},
		url: 'http://localhost:4299',
		reuseExistingServer: false,
		timeout: 120_000
	}
});
