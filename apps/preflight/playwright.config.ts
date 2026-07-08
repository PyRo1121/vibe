import { defineConfig, devices } from '@playwright/test';

const freeServerUrl = 'http://localhost:4299';
const paidServerUrl = 'http://localhost:4300';

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
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
		video: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			testIgnore: /billing-flow\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], baseURL: freeServerUrl }
		},
		{
			name: 'billing-paid',
			testMatch: /billing-flow\.spec\.ts/,
			use: { ...devices['Desktop Chrome'], baseURL: paidServerUrl }
		}
	],
	webServer: [
		{
			name: 'free-mode',
			command: 'npm run dev -- --port 4299',
			env: {
				...process.env,
				DEPLOYLINT_PLATFORM_PROXY_CONFIG: 'wrangler.e2e.jsonc'
			},
			url: freeServerUrl,
			reuseExistingServer: false,
			timeout: 120_000
		},
		{
			name: 'paid-billing-mode',
			command: 'npm run dev -- --port 4300',
			env: {
				...process.env,
				DEPLOYLINT_PLATFORM_PROXY_CONFIG: 'wrangler.e2e.paid.jsonc'
			},
			url: paidServerUrl,
			reuseExistingServer: false,
			timeout: 120_000
		}
	]
});
