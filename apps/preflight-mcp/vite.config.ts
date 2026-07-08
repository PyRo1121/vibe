import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		exclude: ['dist/**', 'node_modules/**'],
		passWithNoTests: false,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
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
