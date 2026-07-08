import { defineConfig } from 'vitest/config';

const testReporters =
	process.env.GITHUB_ACTIONS === 'true'
		? ['default', 'github-actions', 'junit']
		: ['default', 'junit'];

export default defineConfig({
	test: {
		environment: 'node',
		include: ['*.test.js'],
		exclude: ['coverage/**', 'node_modules/**'],
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
			include: ['index.js'],
			exclude: ['*.test.js', 'vitest.config.ts'],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100
			}
		}
	}
});
