import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			platformProxy: {
				configPath: 'wrangler.jsonc'
			}
		}),
		inlineStyleThreshold: 60_000
	}
};

export default config;
