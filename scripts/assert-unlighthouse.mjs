import { readFile } from 'node:fs/promises';

const reportPath = process.argv[2] ?? 'tmp/unlighthouse/ci-result.json';
const expectedRoutes = Number(process.env.UNLIGHTHOUSE_EXPECTED_ROUTES ?? 10);
const thresholds = {
	score: 0.95,
	performance: 0.8,
	accessibility: 0.95,
	'best-practices': 1,
	seo: 1
};

const results = JSON.parse(await readFile(reportPath, 'utf8'));
const failures = [];

if (results.length < expectedRoutes) {
	failures.push(`expected at least ${expectedRoutes} scanned routes, got ${results.length}`);
}

for (const result of results) {
	for (const [key, threshold] of Object.entries(thresholds)) {
		const score = result[key];
		if (typeof score === 'number' && score < threshold) {
			failures.push(
				`${result.path} ${key} ${Math.round(score * 100)} < ${Math.round(threshold * 100)}`
			);
		}
	}
}

console.table(
	results.map((result) => ({
		path: result.path,
		score: Math.round(result.score * 100),
		performance: Math.round(result.performance * 100),
		accessibility: Math.round(result.accessibility * 100),
		bestPractices: Math.round(result['best-practices'] * 100),
		seo: Math.round(result.seo * 100)
	}))
);

if (failures.length > 0) {
	throw new Error(`Unlighthouse assertions failed:\n${failures.join('\n')}`);
}

console.log(`Unlighthouse assertions passed for ${results.length} routes.`);
