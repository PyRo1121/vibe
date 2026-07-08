import { defineConfig } from 'vitest/config';

const testReporters =
	process.env.GITHUB_ACTIONS === 'true'
		? ['default', 'github-actions', 'junit']
		: ['default', 'junit'];

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		exclude: ['dist/**', 'node_modules/**'],
		allowOnly: false,
		passWithNoTests: false,
		reporters: testReporters,
		outputFile: {
			junit: 'test-results/vitest-junit.xml'
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'json-summary', 'html'],
			reportsDirectory: 'coverage',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types.ts'],
			thresholds: {
				lines: 95,
				functions: 98,
				branches: 90,
				statements: 95
			}
		}
	}
});
