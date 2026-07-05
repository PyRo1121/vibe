import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createDeploylintServer } from './server.js';

async function main() {
	const transport = new StdioServerTransport();
	await createDeploylintServer().connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
