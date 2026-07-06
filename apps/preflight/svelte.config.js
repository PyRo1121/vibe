import adapter from '@sveltejs/adapter-cloudflare';

const platformProxyConfigPath = process.env.DEPLOYLINT_PLATFORM_PROXY_CONFIG ?? 'wrangler.jsonc';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			platformProxy: {
				configPath: platformProxyConfigPath
			}
		}),
		inlineStyleThreshold: 60_000
	}
};

export default config;
