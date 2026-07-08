import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const packages = [
	{
		name: '@vibe/deploylint-shared',
		rootPath: 'apps/deploylint-shared',
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
		rootPath: 'apps/preflight',
		summaryPath: 'apps/preflight/coverage/coverage-summary.json',
		minimums: {
			statements: 95,
			branches: 90,
			functions: 98,
			lines: 95
		},
		perFileMinimums: [
			{
				label: 'src/lib/billing/**.ts',
				pathPrefix: 'src/lib/billing/',
				minimums: { statements: 93, branches: 88, functions: 100, lines: 94 }
			},
			{
				label: 'src/lib/ci/**.ts',
				pathPrefix: 'src/lib/ci/',
				minimums: { statements: 98, branches: 95, functions: 100, lines: 100 }
			},
			{
				label: 'src/lib/monitoring/**.ts',
				pathPrefix: 'src/lib/monitoring/',
				minimums: { statements: 93, branches: 84, functions: 100, lines: 96 }
			},
			{
				label: 'src/lib/scan/repo/**.ts',
				pathPrefix: 'src/lib/scan/repo/',
				minimums: { statements: 90, branches: 75, functions: 95, lines: 94 }
			},
			{
				label: 'src/lib/server/**.ts',
				pathPrefix: 'src/lib/server/',
				minimums: { statements: 88, branches: 86, functions: 83, lines: 92 }
			},
			{
				label: 'src/routes/api/**/+server.ts',
				pathPrefix: 'src/routes/api/',
				minimums: { statements: 96, branches: 91, functions: 100, lines: 100 }
			}
		]
	},
	{
		name: 'preflight-mcp',
		rootPath: 'apps/preflight-mcp',
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

function filePct(summary, metric) {
	const value = summary?.[metric]?.pct;
	if (typeof value !== 'number' || Number.isNaN(value)) {
		throw new Error(`Coverage summary is missing ${metric}.pct for a covered file`);
	}
	return value;
}

function toPosixPath(value) {
	return value.replaceAll('\\', '/');
}

function packageRelativePath(pkg, filePath) {
	const relativePath = toPosixPath(relative(resolve(pkg.rootPath), resolve(filePath)));
	if (relativePath && !relativePath.startsWith('../') && relativePath !== '..') {
		return relativePath;
	}

	const normalized = toPosixPath(filePath);
	const rootMarker = `${toPosixPath(pkg.rootPath).replace(/\/$/, '')}/`;
	const rootIndex = normalized.indexOf(rootMarker);
	if (rootIndex >= 0) return normalized.slice(rootIndex + rootMarker.length);
	return normalized;
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

	for (const rule of pkg.perFileMinimums ?? []) {
		let matched = 0;
		for (const [filePath, fileSummary] of Object.entries(summary)) {
			if (filePath === 'total') continue;
			const relativePath = packageRelativePath(pkg, filePath);
			if (!relativePath.startsWith(rule.pathPrefix)) continue;
			matched += 1;

			for (const metric of metrics) {
				const actual = filePct(fileSummary, metric);
				const minimum = rule.minimums[metric];
				if (actual < minimum) {
					failures.push(
						`${pkg.name} ${relativePath} ${metric}: ${actual}% below critical per-file floor ${minimum}% for ${rule.label}`
					);
				}
			}
		}

		if (matched === 0) {
			failures.push(`${pkg.name} ${rule.label}: no files matched critical per-file coverage floor`);
		} else {
			console.log(
				`${pkg.name}: checked ${matched} files against critical per-file coverage floor ${rule.label}`
			);
		}
	}
}

if (failures.length > 0) {
	console.error(
		`Deploylint coverage floors failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`
	);
	process.exit(1);
}

console.log('Deploylint coverage summaries meet configured floors.');
