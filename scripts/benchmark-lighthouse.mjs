import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(currentDir, '..');
const outputRoot = resolvePath(
	repoRoot,
	'tmp',
	'benchmarks',
	new Date().toISOString().replace(/[:.]/g, '-')
);
const defaultUrls = [
	'https://deploylint.com/',
	'https://deploylint.com/checks',
	'https://deploylint.com/compare',
	'https://deploylint.com/developers',
	'https://deploylint.com/guides/lighthouse-alternative'
];
const categoryThresholds = {
	performance: 0.95,
	accessibility: 1,
	'best-practices': 1,
	seo: 1,
	'agentic-browsing': 1
};

function parseArgs(args) {
	const urls = [];
	let devices = ['desktop', 'mobile'];

	for (const arg of args) {
		if (arg === '--desktop') {
			devices = ['desktop'];
		} else if (arg === '--mobile') {
			devices = ['mobile'];
		} else if (arg === '--both') {
			devices = ['desktop', 'mobile'];
		} else if (arg.startsWith('--urls=')) {
			urls.push(...arg.slice('--urls='.length).split(',').filter(Boolean));
		} else if (!arg.startsWith('--')) {
			urls.push(arg);
		}
	}

	return { urls: urls.length > 0 ? urls : defaultUrls, devices };
}

async function getFreePort() {
	return await new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			server.close(() => {
				if (typeof address === 'object' && address !== null) {
					resolve(address.port);
				} else {
					reject(new Error('Could not allocate a local debugging port.'));
				}
			});
		});
	});
}

async function waitForChrome(port) {
	const endpoint = `http://127.0.0.1:${port}/json/version`;
	const startedAt = Date.now();

	while (Date.now() - startedAt < 10_000) {
		try {
			const response = await fetch(endpoint);
			if (response.ok) {
				return;
			}
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}

	throw new Error(`Chromium did not expose a debugging endpoint on port ${port}.`);
}

function run(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: repoRoot,
			stdio: 'inherit',
			windowsHide: true
		});
		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
			}
		});
	});
}

function npmExecCommand(args) {
	if (process.env.npm_execpath) {
		return {
			command: process.execPath,
			args: [process.env.npm_execpath, ...args]
		};
	}

	return {
		command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
		args
	};
}

function slugify(value) {
	return value
		.replace(/^https?:\/\//, '')
		.replace(/[^a-z0-9]+/gi, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

async function runLighthouse({ url, device, port }) {
	const name = `${device}-${slugify(url)}`;
	const outputPath = join(outputRoot, `${name}.json`);
	const lighthouseArgs = [
		'exec',
		'--yes',
		'--package',
		'lighthouse@latest',
		'--',
		'lighthouse',
		url,
		`--port=${port}`,
		'--output=json',
		`--output-path=${outputPath}`,
		'--quiet'
	];

	if (device === 'desktop') {
		lighthouseArgs.push('--preset=desktop');
	}

	const { command, args } = npmExecCommand(lighthouseArgs);
	await run(command, args);

	const report = JSON.parse(await readFile(outputPath, 'utf8'));
	const categories = Object.fromEntries(
		Object.entries(report.categories).map(([id, category]) => [id, category.score])
	);
	const metrics = Object.fromEntries(
		[
			'first-contentful-paint',
			'largest-contentful-paint',
			'total-blocking-time',
			'cumulative-layout-shift',
			'speed-index',
			'interactive'
		].map((id) => [id, report.audits[id]?.displayValue ?? null])
	);

	return { url, device, outputPath, categories, metrics };
}

function assertThresholds(results) {
	const failures = [];

	for (const result of results) {
		for (const [category, threshold] of Object.entries(categoryThresholds)) {
			const score = result.categories[category];
			if (typeof score === 'number' && score < threshold) {
				failures.push(
					`${result.device} ${result.url} ${category} ${Math.round(score * 100)} < ${Math.round(threshold * 100)}`
				);
			}
		}
	}

	if (failures.length > 0) {
		throw new Error(`Lighthouse benchmark failed:\n${failures.join('\n')}`);
	}
}

const { urls, devices } = parseArgs(process.argv.slice(2));
const port = await getFreePort();
const profileDir = join(outputRoot, 'chrome-profile');
await mkdir(outputRoot, { recursive: true });

const chrome = spawn(
	chromium.executablePath(),
	[
		'--headless=new',
		`--remote-debugging-port=${port}`,
		'--disable-gpu',
		'--no-first-run',
		'--no-default-browser-check',
		`--user-data-dir=${profileDir}`,
		'about:blank'
	],
	{ stdio: 'ignore', windowsHide: true }
);

function waitForExit(child) {
	return new Promise((resolve) => {
		if (child.exitCode !== null) {
			resolve();
		} else {
			child.once('exit', resolve);
		}
	});
}

try {
	await waitForChrome(port);

	const results = [];
	for (const url of urls) {
		for (const device of devices) {
			results.push(await runLighthouse({ url, device, port }));
		}
	}

	assertThresholds(results);
	const summary = {
		generatedAt: new Date().toISOString(),
		thresholds: categoryThresholds,
		results: results.map(({ outputPath, ...result }) => ({
			...result,
			report: outputPath
		}))
	};
	await writeFile(join(outputRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
	console.table(
		results.map((result) => ({
			device: result.device,
			url: result.url,
			performance: Math.round(result.categories.performance * 100),
			accessibility: Math.round(result.categories.accessibility * 100),
			bestPractices: Math.round(result.categories['best-practices'] * 100),
			seo: Math.round(result.categories.seo * 100),
			agentic: result.categories['agentic-browsing']
				? Math.round(result.categories['agentic-browsing'] * 100)
				: 'n/a',
			lcp: result.metrics['largest-contentful-paint'],
			cls: result.metrics['cumulative-layout-shift']
		}))
	);
	console.log(`Benchmark reports written to ${outputRoot}`);
} finally {
	if (!chrome.killed) {
		chrome.kill();
	}
	await waitForExit(chrome);
	await rm(profileDir, { recursive: true, force: true });
}
