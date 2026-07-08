import { readFileSync } from 'node:fs';

const packages = [
	{
		name: '@vibe/deploylint-shared',
		summaryPath: 'apps/deploylint-shared/coverage/coverage-summary.json',
		minimums: {
			statements: 100,
			branches: 100,
			functions: 100,
			lines: 100
		}
	},
	{
		name: 'preflight',
		summaryPath: 'apps/preflight/coverage/coverage-summary.json',
		minimums: {
			statements: 95,
			branches: 90,
			functions: 98,
			lines: 95
		}
	},
	{
		name: 'preflight-mcp',
		summaryPath: 'apps/preflight-mcp/coverage/coverage-summary.json',
		minimums: {
			statements: 95,
			branches: 90,
			functions: 98,
			lines: 95
		}
	}
];

const metrics = ['statements', 'branches', 'functions', 'lines'];

function readSummary(path) {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`Coverage summary missing or unreadable at ${path}: ${error.message}`);
	}
}

function pct(summary, metric) {
	const value = summary?.total?.[metric]?.pct;
	if (typeof value !== 'number' || Number.isNaN(value)) {
		throw new Error(`Coverage summary is missing total.${metric}.pct`);
	}
	return value;
}

const failures = [];

for (const pkg of packages) {
	const summary = readSummary(pkg.summaryPath);
	const result = metrics.map((metric) => {
		const actual = pct(summary, metric);
		const minimum = pkg.minimums[metric];
		if (actual < minimum) {
			failures.push(`${pkg.name} ${metric}: ${actual}% below ${minimum}%`);
		}
		return `${metric} ${actual}%`;
	});
	console.log(`${pkg.name}: ${result.join(', ')}`);
}

if (failures.length > 0) {
	console.error(
		`Deploylint coverage floors failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`
	);
	process.exit(1);
}

console.log('Deploylint coverage summaries meet configured floors.');
