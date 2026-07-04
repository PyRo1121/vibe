import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run preview', port: 8787, reuseExistingServer: !process.env.CI },
	testMatch: '**/*.e2e.{ts,js}'
});
