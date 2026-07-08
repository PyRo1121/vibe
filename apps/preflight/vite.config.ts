import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const testReporters =
	process.env.GITHUB_ACTIONS === 'true'
		? ['default', 'github-actions', 'junit']
		: ['default', 'junit'];

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rolldownOptions: {
			external: ['cloudflare:workers']
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		allowOnly: false,
		passWithNoTests: false,
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
				'src/lib/test/**',
				'src/lib/ui/**'
			],
			thresholds: {
				lines: 95,
				functions: 98,
				branches: 90,
				statements: 95,
				'src/lib/billing/**.ts': {
					lines: 96,
					functions: 100,
					branches: 92,
					statements: 94
				},
				'src/lib/ci/**.ts': {
					lines: 97,
					functions: 100,
					branches: 84,
					statements: 95
				},
				'src/lib/monitoring/**.ts': {
					lines: 97,
					functions: 100,
					branches: 91,
					statements: 95
				},
				'src/lib/scan/repo/**.ts': {
					lines: 98,
					functions: 97,
					branches: 90,
					statements: 97
				},
				'src/lib/server/**.ts': {
					lines: 98,
					functions: 97,
					branches: 92,
					statements: 97
				},
				'src/routes/api/**/+server.ts': {
					lines: 95,
					functions: 100,
					branches: 90,
					statements: 95
				}
			}
		}
	}
});
