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
				lines: 90,
				functions: 90,
				branches: 80,
				statements: 90
			}
		}
	}
});
