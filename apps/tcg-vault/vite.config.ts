import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const testReporters =
	process.env.GITHUB_ACTIONS === 'true'
		? ['default', 'github-actions', 'junit']
		: ['default', 'junit'];

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		reporters: testReporters,
		outputFile: {
			junit: 'test-results/vitest-junit.xml'
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			reportsDirectory: 'coverage',
			include: [
				'src/lib/**/*.{ts,js}',
				'src/hooks.server.ts',
				'src/routes/**/+server.{ts,js}',
				'src/routes/**/+page.server.{ts,js}',
				'src/routes/**/+layout.server.{ts,js}'
			],
			exclude: [
				'src/**/*.{test,spec}.{ts,js}',
				'src/**/*.d.ts',
				'src/lib/assets/**',
				'src/lib/components/**'
			],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 85,
				statements: 90
			}
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
