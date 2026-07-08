import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

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
		passWithNoTests: false,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			reportsDirectory: 'coverage',
			include: ['src/lib/**/*.{ts,js}', 'src/hooks.server.ts'],
			exclude: [
				'src/**/*.{test,spec}.{ts,js}',
				'src/**/*.d.ts',
				'src/lib/test/**',
				'src/lib/ui/**',
				'src/lib/client/plausible.ts',
				'src/lib/client/track.ts'
			],
			thresholds: {
				lines: 95,
				functions: 98,
				branches: 90,
				statements: 95
			}
		}
	}
});
