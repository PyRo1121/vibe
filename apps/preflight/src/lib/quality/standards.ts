import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

import { analyzeWorkflowPermissions } from '../ci/workflow-permissions';

export const ENTERPRISE_COVERAGE_MINIMUMS = {
	statements: 95,
	lines: 95,
	functions: 98,
	branches: 90
} as const;

type CoverageMetric = keyof typeof ENTERPRISE_COVERAGE_MINIMUMS;
type CoverageThresholds = Record<CoverageMetric, number>;
type ScopedCoverageThresholds = Record<string, CoverageThresholds>;

const COVERAGE_METRICS: CoverageMetric[] = ['statements', 'lines', 'functions', 'branches'];

const DISABLED_TEST_MODIFIERS = new Set(['only', 'skip', 'fixme', 'todo']);

const DEPLOYLINT_WORKFLOW_PATH_FILTERS = [
	'apps/preflight/**',
	'apps/preflight-mcp/**',
	'apps/deploylint-shared/**',
	'.github/actions/deploylint-gate/**',
	'package.json',
	'package-lock.json',
	'turbo.json',
	'knip.deploylint.jsonc',
	'renovate.json',
	'.oxlintrc.jsonc',
	'.oxfmtrc.jsonc',
	'svelte.config.js',
	'.github/dependabot.yml',
	'.nvmrc',
	'scripts/assert-unlighthouse.mjs',
	'scripts/benchmark-lighthouse.mjs',
	'.github/workflows/preflight-gate.yml',
	'.github/workflows/deploylint-dogfood.yml',
	'.github/workflows/tcg-vault-gate.yml'
];

const DEPLOYLINT_TEST_SOURCE_ROOTS = [
	'apps/deploylint-shared',
	'apps/preflight/e2e',
	'apps/preflight/src',
	'apps/preflight-mcp/src'
];

const GITHUB_ACTION_SHA = /^[a-f0-9]{40}$/i;

const PINNED_WORKFLOW_ACTIONS = {
	checkout: 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
	dependencyReview: 'actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294',
	setupNode: 'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
	uploadArtifact: 'actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f'
} as const;

export const CRITICAL_COVERAGE_THRESHOLDS = {
	'src/lib/billing/**.ts': {
		statements: 94,
		lines: 96,
		functions: 100,
		branches: 92
	},
	'src/lib/ci/**.ts': {
		statements: 95,
		lines: 97,
		functions: 100,
		branches: 90
	},
	'src/lib/monitoring/**.ts': {
		statements: 95,
		lines: 97,
		functions: 100,
		branches: 91
	},
	'src/lib/scan/repo/**.ts': {
		statements: 97,
		lines: 98,
		functions: 97,
		branches: 90
	},
	'src/lib/server/**.ts': {
		statements: 97,
		lines: 98,
		functions: 97,
		branches: 92
	},
	'src/routes/api/**/+server.ts': {
		statements: 95,
		lines: 95,
		functions: 100,
		branches: 90
	}
} as const satisfies ScopedCoverageThresholds;

export interface QualityStandardsReport {
	checked: string[];
	failures: string[];
	coverageThresholds: CoverageThresholds;
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const repoRoot = resolve(appRoot, '../..');

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCoverageMetric(value: string): value is CoverageMetric {
	return COVERAGE_METRICS.some((metric) => metric === value);
}

function readJsonRecord(path: string): Record<string, unknown> {
	const value = readJson(path);
	return isRecord(value) ? value : {};
}

function readYamlRecord(path: string): Record<string, unknown> {
	const value: unknown = parseYaml(readFileSync(path, 'utf8'), { stringKeys: true });
	return isRecord(value) ? value : {};
}

function readStringRecord(value: unknown): Record<string, string> {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
	);
}

function readPrimitiveRecord(value: unknown): Record<string, string | number | boolean> {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string | number | boolean] =>
				typeof entry[1] === 'string' ||
				typeof entry[1] === 'number' ||
				typeof entry[1] === 'boolean'
		)
	);
}

function readStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function readPackageConfig(path: string): {
	devDependencies: Record<string, string>;
	engines?: { node?: string };
	packageManager?: string;
	scripts: Record<string, string>;
} {
	const json = readJsonRecord(path);
	const engines = isRecord(json.engines) ? json.engines : null;
	return {
		devDependencies: readStringRecord(json.devDependencies),
		engines: engines && typeof engines.node === 'string' ? { node: engines.node } : undefined,
		packageManager: typeof json.packageManager === 'string' ? json.packageManager : undefined,
		scripts: readStringRecord(json.scripts)
	};
}

function readTsconfig(path: string): { compilerOptions?: Record<string, unknown> } {
	const json = readJsonRecord(path);
	return {
		compilerOptions: isRecord(json.compilerOptions) ? json.compilerOptions : undefined
	};
}

function readOxlintConfig(path: string): {
	categories: Record<string, string>;
	options: Record<string, string | number | boolean>;
	plugins: string[];
	rules: Record<string, string>;
} {
	const json = readJsonRecord(path);
	return {
		categories: readStringRecord(json.categories),
		options: readPrimitiveRecord(json.options),
		plugins: readStringArray(json.plugins),
		rules: readStringRecord(json.rules)
	};
}

function readKnipConfig(path: string): {
	sveltekit?: unknown;
	workspaces: Record<string, unknown>;
} {
	const json = readJsonRecord(path);
	return {
		sveltekit: json.sveltekit,
		workspaces: isRecord(json.workspaces) ? json.workspaces : {}
	};
}

function coverageThresholdsMeet(
	actual: CoverageThresholds,
	minimums: Record<CoverageMetric, number>
): boolean {
	return COVERAGE_METRICS.every((metric) => actual[metric] >= minimums[metric]);
}

function listSourceFiles(root: string): string[] {
	if (!existsSync(root)) return [];

	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const path = join(root, entry.name);
		if (entry.isDirectory()) return listSourceFiles(path);
		if (!entry.isFile() || !/\.[jt]s$/.test(entry.name)) return [];
		return [path];
	});
}

function hasScriptCommand(
	scripts: Record<string, string>,
	scriptName: string,
	fragments: string[]
) {
	const command = scripts[scriptName] ?? '';
	return fragments.every((fragment) => command.includes(fragment));
}

function hasRuleLevelOxlintAllowance(command: string): boolean {
	return /(?:^|\s)(?:-A|--allow)(?:\s|=)/.test(command);
}

function hasWorkspaceScopedSvelteKitConfig(
	config: { sveltekit?: unknown; workspaces: Record<string, unknown> },
	workspace: string,
	expectedConfigPath: string
): boolean {
	if (config.sveltekit !== false) return false;
	const workspaceConfig = config.workspaces[workspace];
	if (!isRecord(workspaceConfig)) return false;

	const sveltekit = workspaceConfig.sveltekit;
	if (!isRecord(sveltekit) || !Array.isArray(sveltekit.config)) return false;

	return sveltekit.config.includes(expectedConfigPath);
}

function propertyNameText(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
		return name.text;
	}
	return null;
}

function findObjectProperty(
	source: ts.SourceFile,
	propertyName: string
): ts.ObjectLiteralExpression | null {
	let found: ts.ObjectLiteralExpression | null = null;

	function visit(node: ts.Node) {
		if (found) return;
		if (
			ts.isPropertyAssignment(node) &&
			propertyNameText(node.name) === propertyName &&
			ts.isObjectLiteralExpression(node.initializer)
		) {
			found = node.initializer;
			return;
		}
		ts.forEachChild(node, visit);
	}

	visit(source);
	return found;
}

function propertyAccessPath(expression: ts.Expression): string[] {
	const path: string[] = [];
	let current: ts.Expression = expression;

	while (ts.isPropertyAccessExpression(current)) {
		path.unshift(current.name.text);
		current = current.expression;
	}

	if (ts.isIdentifier(current)) {
		path.unshift(current.text);
	}

	return path;
}

function isDisabledTestCall(expression: ts.Expression): boolean {
	const path = propertyAccessPath(expression);
	const modifier = path.at(-1);
	if (!modifier || !DISABLED_TEST_MODIFIERS.has(modifier)) return false;

	const owner = path.at(-2);
	const nestedOwner = path.at(-3);
	return owner === 'test' || owner === 'it' || owner === 'describe' || nestedOwner === 'test';
}

function findDisabledTestModifiers(rootDir: string): string[] {
	const testFiles = DEPLOYLINT_TEST_SOURCE_ROOTS.flatMap((sourceRoot) =>
		listSourceFiles(join(rootDir, sourceRoot))
	);
	return testFiles.flatMap((path) => {
		const source = ts.createSourceFile(
			path,
			readFileSync(path, 'utf8'),
			ts.ScriptTarget.Latest,
			true
		);
		const violations: string[] = [];

		function visit(node: ts.Node) {
			if (ts.isCallExpression(node) && isDisabledTestCall(node.expression)) {
				violations.push(relative(rootDir, path));
			}
			ts.forEachChild(node, visit);
		}

		visit(source);
		return violations;
	});
}

function readCoverageThresholds(viteConfigPath: string): CoverageThresholds {
	const source = ts.createSourceFile(
		viteConfigPath,
		readFileSync(viteConfigPath, 'utf8'),
		ts.ScriptTarget.Latest,
		true
	);
	const thresholds = findObjectProperty(source, 'thresholds');
	const values: Partial<CoverageThresholds> = {};

	for (const prop of thresholds?.properties ?? []) {
		if (!ts.isPropertyAssignment(prop) || !ts.isNumericLiteral(prop.initializer)) continue;
		const name = propertyNameText(prop.name);
		if (!name || !isCoverageMetric(name)) continue;
		values[name] = Number(prop.initializer.text);
	}

	return {
		statements: values.statements ?? 0,
		lines: values.lines ?? 0,
		functions: values.functions ?? 0,
		branches: values.branches ?? 0
	};
}

function readScopedCoverageThresholds(viteConfigPath: string): ScopedCoverageThresholds {
	const source = ts.createSourceFile(
		viteConfigPath,
		readFileSync(viteConfigPath, 'utf8'),
		ts.ScriptTarget.Latest,
		true
	);
	const thresholds = findObjectProperty(source, 'thresholds');
	const scoped: ScopedCoverageThresholds = {};

	for (const prop of thresholds?.properties ?? []) {
		if (!ts.isPropertyAssignment(prop) || !ts.isObjectLiteralExpression(prop.initializer)) {
			continue;
		}
		const name = propertyNameText(prop.name);
		if (!name) continue;

		const values: Partial<CoverageThresholds> = {};
		for (const thresholdProp of prop.initializer.properties) {
			if (
				!ts.isPropertyAssignment(thresholdProp) ||
				!ts.isNumericLiteral(thresholdProp.initializer)
			) {
				continue;
			}
			const thresholdName = propertyNameText(thresholdProp.name);
			if (!thresholdName || !isCoverageMetric(thresholdName)) continue;
			values[thresholdName] = Number(thresholdProp.initializer.text);
		}

		scoped[name] = {
			statements: values.statements ?? 0,
			lines: values.lines ?? 0,
			functions: values.functions ?? 0,
			branches: values.branches ?? 0
		};
	}

	return scoped;
}

function readBooleanConfigProperty(configPath: string, propertyName: string): boolean | null {
	const source = ts.createSourceFile(
		configPath,
		readFileSync(configPath, 'utf8'),
		ts.ScriptTarget.Latest,
		true
	);
	let found: boolean | null = null;

	function visit(node: ts.Node) {
		if (found !== null) return;
		if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === propertyName) {
			if (node.initializer.kind === ts.SyntaxKind.TrueKeyword) {
				found = true;
				return;
			}
			if (node.initializer.kind === ts.SyntaxKind.FalseKeyword) {
				found = false;
				return;
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(source);
	return found;
}

function includesScopedThresholds(
	actual: ScopedCoverageThresholds,
	expected: ScopedCoverageThresholds
): boolean {
	return Object.entries(expected).every(([pattern, thresholds]) => {
		const configured = actual[pattern];
		return (
			configured !== undefined &&
			COVERAGE_METRICS.every((metric) => configured[metric] >= thresholds[metric])
		);
	});
}

function hasVitestJUnitArtifacts(configSource: string): boolean {
	return (
		configSource.includes('reporters: testReporters') &&
		configSource.includes("'github-actions'") &&
		configSource.includes("'junit'") &&
		configSource.includes('outputFile:') &&
		configSource.includes("junit: 'test-results/vitest-junit.xml'")
	);
}

function pushCheck(checked: string[], failures: string[], label: string, pass: boolean) {
	if (pass) {
		checked.push(label);
	} else {
		failures.push(label);
	}
}

function hasLeastPrivilegeWorkflowPermissions(workflow: string): boolean {
	const permissions = analyzeWorkflowPermissions(workflow);
	return permissions.contentsRead && !permissions.writeAll && permissions.writeScopes.length === 0;
}

function readRecordProperty(record: Record<string, unknown>, key: string): Record<string, unknown> {
	const value = record[key];
	return isRecord(value) ? value : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readWorkflowEvent(workflow: Record<string, unknown>, event: string): unknown {
	const triggers = workflow.on;
	if (typeof triggers === 'string') return triggers === event ? true : undefined;
	if (Array.isArray(triggers)) return triggers.includes(event) ? true : undefined;
	if (!isRecord(triggers)) return undefined;
	return Object.hasOwn(triggers, event) ? triggers[event] : undefined;
}

function workflowEventHasPaths(
	workflow: Record<string, unknown>,
	event: string,
	expectedPaths: string[]
): boolean {
	const config = readWorkflowEvent(workflow, event);
	if (!isRecord(config)) return false;
	const paths = readStringArray(config.paths);
	return expectedPaths.every((path) => paths.includes(path));
}

function workflowEventHasMainBranch(workflow: Record<string, unknown>, event: string): boolean {
	const config = readWorkflowEvent(workflow, event);
	if (!isRecord(config)) return false;
	return readStringArray(config.branches).includes('main');
}

function workflowHasEvent(workflow: Record<string, unknown>, event: string): boolean {
	return readWorkflowEvent(workflow, event) !== undefined;
}

function hasDeploylintCiWorkflowTriggers(workflow: Record<string, unknown>): boolean {
	return (
		workflowEventHasMainBranch(workflow, 'push') &&
		workflowEventHasPaths(workflow, 'push', DEPLOYLINT_WORKFLOW_PATH_FILTERS) &&
		workflowEventHasPaths(workflow, 'pull_request', DEPLOYLINT_WORKFLOW_PATH_FILTERS) &&
		workflowHasEvent(workflow, 'workflow_dispatch')
	);
}

function hasDeploylintDogfoodWorkflowTriggers(workflow: Record<string, unknown>): boolean {
	return (
		workflowEventHasMainBranch(workflow, 'push') &&
		workflowEventHasPaths(workflow, 'push', DEPLOYLINT_WORKFLOW_PATH_FILTERS) &&
		!workflowHasEvent(workflow, 'pull_request') &&
		readRecordArray(readWorkflowEvent(workflow, 'schedule')).some(
			(schedule) => typeof schedule.cron === 'string' && schedule.cron.length > 0
		) &&
		workflowHasEvent(workflow, 'workflow_dispatch')
	);
}

function workflowHasConcurrency(workflow: Record<string, unknown>, prefix: string): boolean {
	const concurrency = readRecordProperty(workflow, 'concurrency');
	return (
		typeof concurrency.group === 'string' &&
		concurrency.group.startsWith(prefix) &&
		concurrency['cancel-in-progress'] === true
	);
}

function workflowJob(workflow: Record<string, unknown>, name: string): Record<string, unknown> {
	return readRecordProperty(readRecordProperty(workflow, 'jobs'), name);
}

function workflowJobSteps(job: Record<string, unknown>): Record<string, unknown>[] {
	return readRecordArray(job.steps);
}

function workflowStepByName(
	steps: Record<string, unknown>[],
	name: string
): Record<string, unknown> | null {
	return steps.find((step) => step.name === name) ?? null;
}

function workflowUsesStep(steps: Record<string, unknown>[], uses: string): boolean {
	return steps.some((step) => step.uses === uses);
}

function workflowAllSteps(workflow: Record<string, unknown>): Record<string, unknown>[] {
	const jobs = readRecordProperty(workflow, 'jobs');
	return Object.values(jobs).flatMap((job) => (isRecord(job) ? workflowJobSteps(job) : []));
}

function isExternalWorkflowUse(uses: string): boolean {
	return (
		!uses.startsWith('./') &&
		!uses.startsWith('../') &&
		!uses.startsWith('/') &&
		!uses.startsWith('docker://')
	);
}

function workflowExternalActionUsesAreShaPinned(workflow: Record<string, unknown>): boolean {
	return workflowAllSteps(workflow).every((step) => {
		if (typeof step.uses !== 'string' || !isExternalWorkflowUse(step.uses)) return true;
		const atIndex = step.uses.lastIndexOf('@');
		return atIndex > 0 && GITHUB_ACTION_SHA.test(step.uses.slice(atIndex + 1));
	});
}

function workflowRunStepIncludes(
	steps: Record<string, unknown>[],
	name: string,
	fragments: string[]
): boolean {
	const step = workflowStepByName(steps, name);
	const run = step?.run;
	return typeof run === 'string' && fragments.every((fragment) => run.includes(fragment));
}

function workflowStepWith(step: Record<string, unknown>): Record<string, unknown> {
	return isRecord(step.with) ? step.with : {};
}

function workflowStepEnv(step: Record<string, unknown>): Record<string, unknown> {
	return isRecord(step.env) ? step.env : {};
}

function multilineValueIncludes(value: unknown, expected: string[]): boolean {
	return typeof value === 'string' && expected.every((item) => value.includes(item));
}

function hasSetupNodeStep(steps: Record<string, unknown>[]): boolean {
	const step = steps.find((candidate) => candidate.uses === PINNED_WORKFLOW_ACTIONS.setupNode);
	if (!step) return false;
	const withConfig = workflowStepWith(step);
	return withConfig['node-version-file'] === '.nvmrc' && withConfig.cache === 'npm';
}

function hasArtifactUploadStep(
	steps: Record<string, unknown>[],
	name: string,
	expectedPaths: string[]
): boolean {
	const step = workflowStepByName(steps, name);
	if (!step || step.uses !== PINNED_WORKFLOW_ACTIONS.uploadArtifact || step.if !== 'failure()') {
		return false;
	}
	const withConfig = workflowStepWith(step);
	return (
		withConfig['if-no-files-found'] === 'ignore' &&
		withConfig['retention-days'] === 14 &&
		multilineValueIncludes(withConfig.path, expectedPaths)
	);
}

function workflowJobHasTimeout(job: Record<string, unknown>, minutes: number): boolean {
	return job['runs-on'] === 'ubuntu-latest' && job['timeout-minutes'] === minutes;
}

function hasPreflightGateWorkflowContract(workflow: Record<string, unknown>): boolean {
	const gate = workflowJob(workflow, 'gate');
	const dependencyReview = workflowJob(workflow, 'dependency-review');
	const gateSteps = workflowJobSteps(gate);
	const dependencySteps = workflowJobSteps(dependencyReview);
	const requireUrl = workflowStepByName(gateSteps, 'Require production gate URL on main pushes');
	const requireUrlEnv = requireUrl ? workflowStepEnv(requireUrl) : {};
	const scanProduction = workflowStepByName(gateSteps, 'Scan production URL');
	const scanEnv = scanProduction ? workflowStepEnv(scanProduction) : {};

	return (
		workflowHasConcurrency(workflow, 'deploylint-gate-') &&
		workflowJobHasTimeout(dependencyReview, 10) &&
		dependencyReview.if === "github.event_name == 'pull_request'" &&
		workflowUsesStep(dependencySteps, PINNED_WORKFLOW_ACTIONS.checkout) &&
		workflowUsesStep(dependencySteps, PINNED_WORKFLOW_ACTIONS.dependencyReview) &&
		workflowStepWith(
			dependencySteps.find((step) => step.uses === PINNED_WORKFLOW_ACTIONS.dependencyReview) ?? {}
		)['fail-on-severity'] === 'moderate' &&
		workflowJobHasTimeout(gate, 30) &&
		workflowUsesStep(gateSteps, PINNED_WORKFLOW_ACTIONS.checkout) &&
		hasSetupNodeStep(gateSteps) &&
		workflowRunStepIncludes(gateSteps, 'Install dependencies', ['npm ci']) &&
		workflowRunStepIncludes(gateSteps, 'Verify Deploylint CI suite', [
			'npm run verify:deploylint:ci'
		]) &&
		hasArtifactUploadStep(gateSteps, 'Upload Deploylint failure artifacts', [
			'apps/deploylint-shared/coverage/**',
			'apps/deploylint-shared/test-results/**',
			'apps/preflight/coverage/**',
			'apps/preflight/playwright-report/**',
			'apps/preflight/test-results/**',
			'apps/preflight-mcp/coverage/**',
			'apps/preflight-mcp/test-results/**'
		]) &&
		requireUrl?.if === "github.event_name == 'push'" &&
		requireUrlEnv.PREFLIGHT_GATE_URL === '${{ secrets.PREFLIGHT_GATE_URL }}' &&
		requireUrlEnv.DEPLOYLINT_GATE_URL === '${{ secrets.DEPLOYLINT_GATE_URL }}' &&
		workflowRunStepIncludes(gateSteps, 'Require production gate URL on main pushes', [
			'::error::Set PREFLIGHT_GATE_URL or DEPLOYLINT_GATE_URL',
			'exit 2'
		]) &&
		scanEnv.PREFLIGHT_URL ===
			'${{ github.event.inputs.url || secrets.PREFLIGHT_GATE_URL || secrets.DEPLOYLINT_GATE_URL }}' &&
		scanEnv.PREFLIGHT_MIN_SCORE === "${{ github.event.inputs.min_score || '80' }}" &&
		scanEnv.PREFLIGHT_API === 'https://deploylint.com' &&
		workflowRunStepIncludes(gateSteps, 'Scan production URL', [
			'npm run gate -w preflight -- "$PREFLIGHT_URL"'
		])
	);
}

function hasDogfoodWorkflowContract(workflow: Record<string, unknown>): boolean {
	const gate = workflowJob(workflow, 'gate');
	const steps = workflowJobSteps(gate);
	const dogfoodGate = workflowStepByName(steps, 'Gate deploylint.com');
	const dogfoodWith = dogfoodGate ? workflowStepWith(dogfoodGate) : {};

	return (
		workflowHasConcurrency(workflow, 'deploylint-dogfood-') &&
		workflowJobHasTimeout(gate, 45) &&
		workflowUsesStep(steps, PINNED_WORKFLOW_ACTIONS.checkout) &&
		hasSetupNodeStep(steps) &&
		workflowRunStepIncludes(steps, 'Install dependencies', ['npm ci']) &&
		workflowRunStepIncludes(steps, 'Verify npm registry signatures', [
			'npm run audit:signatures'
		]) &&
		workflowRunStepIncludes(steps, 'Verify MCP package', ['npm run verify -w preflight-mcp']) &&
		dogfoodGate?.uses === './.github/actions/deploylint-gate' &&
		dogfoodWith.url === 'https://deploylint.com' &&
		String(dogfoodWith.min_score) === '80' &&
		dogfoodWith.mode === 'gate' &&
		workflowRunStepIncludes(steps, 'Smoke deploylint.com', ['npm run smoke:preflight']) &&
		workflowRunStepIncludes(steps, 'Benchmark deploylint.com', ['npm run bench:site:ci']) &&
		hasArtifactUploadStep(steps, 'Upload dogfood failure artifacts', [
			'apps/preflight-mcp/coverage/**',
			'apps/preflight-mcp/test-results/**',
			'tmp/unlighthouse/**'
		])
	);
}

function dependabotUpdateSection(source: string, ecosystem: string): string | null {
	const updatePattern =
		/(?:^|\n)\s*-\s+package-ecosystem:\s*['"]?([^'"\r\n]+)['"]?[\s\S]*?(?=\n\s*-\s+package-ecosystem:|\s*$)/g;

	for (const match of source.matchAll(updatePattern)) {
		if (match[1] === ecosystem) return match[0];
	}

	return null;
}

function hasWeeklyDependabotUpdate(source: string, ecosystem: string): boolean {
	const section = dependabotUpdateSection(source, ecosystem);
	return (
		section !== null &&
		/^\s*directory:\s*['"]?\/['"]?\s*$/m.test(section) &&
		/^\s*schedule:\s*$/m.test(section) &&
		/^\s*interval:\s*['"]?weekly['"]?\s*$/m.test(section)
	);
}

function hasBoundedGateFetch(source: string): boolean {
	return [
		'DEPLOYLINT_FETCH_TIMEOUT_MS',
		'DEPLOYLINT_FETCH_RETRIES',
		'AbortController',
		'fetchWithRetry',
		'Timed out after'
	].every((fragment) => source.includes(fragment));
}

function hasActionBoundedFetchInputs(source: string): boolean {
	return [
		'fetch_timeout_ms:',
		'fetch_retries:',
		'fetch_retry_delay_ms:',
		'DEPLOYLINT_FETCH_TIMEOUT_MS: ${{ inputs.fetch_timeout_ms }}',
		'DEPLOYLINT_FETCH_RETRIES: ${{ inputs.fetch_retries }}',
		'DEPLOYLINT_FETCH_RETRY_DELAY_MS: ${{ inputs.fetch_retry_delay_ms }}'
	].every((fragment) => source.includes(fragment));
}

function hasPinnedUnlighthouseCommand(command: string, binary: 'unlighthouse' | 'unlighthouse-ci') {
	return (
		command.includes('npm exec --yes') &&
		command.includes('--package unlighthouse@0.18.0') &&
		command.includes('--package puppeteer@25.3.0') &&
		command.includes(`-- ${binary}`) &&
		!command.includes('@latest')
	);
}

export function inspectQualityStandards(rootDir = repoRoot): QualityStandardsReport {
	const preflightRoot = join(rootDir, 'apps/preflight');
	const preflightMcpRoot = join(rootDir, 'apps/preflight-mcp');
	const deploylintSharedRoot = join(rootDir, 'apps/deploylint-shared');
	const rootPackagePath = join(rootDir, 'package.json');
	const rootLockPath = join(rootDir, 'package-lock.json');
	const preflightPackagePath = join(preflightRoot, 'package.json');
	const preflightWranglerPath = join(preflightRoot, 'wrangler.jsonc');
	const preflightTsconfigPath = join(preflightRoot, 'tsconfig.json');
	const preflightScriptsTsconfigPath = join(preflightRoot, 'tsconfig.scripts.json');
	const preflightE2eTsconfigPath = join(preflightRoot, 'tsconfig.e2e.json');
	const preflightMcpPackagePath = join(preflightMcpRoot, 'package.json');
	const preflightMcpTsconfigPath = join(preflightMcpRoot, 'tsconfig.json');
	const deploylintSharedPackagePath = join(deploylintSharedRoot, 'package.json');
	const deploylintSharedTsconfigPath = join(deploylintSharedRoot, 'tsconfig.json');
	const deploylintSharedViteConfigPath = join(deploylintSharedRoot, 'vitest.config.ts');
	const d1MigrationCheckScriptPath = join(preflightRoot, 'scripts/check-d1-migrations.mjs');
	const localGateScriptPath = join(preflightRoot, 'scripts/gate.ts');
	const remoteGateScriptPath = join(preflightRoot, 'scripts/gate-remote.mjs');
	const oxlintPath = join(rootDir, '.oxlintrc.jsonc');
	const oxfmtPath = join(rootDir, '.oxfmtrc.jsonc');
	const rootSvelteConfigPath = join(rootDir, 'svelte.config.js');
	const dependabotPath = join(rootDir, '.github/dependabot.yml');
	const renovatePath = join(rootDir, 'renovate.json');
	const nvmrcPath = join(rootDir, '.nvmrc');
	const knipPath = join(rootDir, 'knip.deploylint.jsonc');
	const viteConfigPath = join(preflightRoot, 'vite.config.ts');
	const mcpViteConfigPath = join(preflightMcpRoot, 'vite.config.ts');
	const playwrightConfigPath = join(preflightRoot, 'playwright.config.ts');
	const deploylintGateActionPath = join(rootDir, '.github/actions/deploylint-gate/action.yml');
	const preflightGateWorkflowPath = join(rootDir, '.github/workflows/preflight-gate.yml');
	const dogfoodWorkflowPath = join(rootDir, '.github/workflows/deploylint-dogfood.yml');
	const tcgVaultWorkflowPath = join(rootDir, '.github/workflows/tcg-vault-gate.yml');
	const checked: string[] = [];
	const failures: string[] = [];
	const coverageThresholds = {
		statements: 0,
		lines: 0,
		functions: 0,
		branches: 0
	};
	const expectedFiles = [
		rootPackagePath,
		rootLockPath,
		preflightPackagePath,
		preflightWranglerPath,
		preflightTsconfigPath,
		preflightScriptsTsconfigPath,
		preflightE2eTsconfigPath,
		preflightMcpPackagePath,
		preflightMcpTsconfigPath,
		deploylintSharedPackagePath,
		deploylintSharedTsconfigPath,
		deploylintSharedViteConfigPath,
		d1MigrationCheckScriptPath,
		localGateScriptPath,
		remoteGateScriptPath,
		oxlintPath,
		oxfmtPath,
		rootSvelteConfigPath,
		dependabotPath,
		renovatePath,
		nvmrcPath,
		knipPath,
		viteConfigPath,
		mcpViteConfigPath,
		playwrightConfigPath,
		deploylintGateActionPath,
		preflightGateWorkflowPath,
		dogfoodWorkflowPath,
		tcgVaultWorkflowPath
	];

	pushCheck(
		checked,
		failures,
		'expected quality config files exist',
		expectedFiles.every((path) => existsSync(path))
	);

	if (failures.length > 0) {
		return {
			checked,
			failures,
			coverageThresholds
		};
	}

	const rootPackage = readPackageConfig(rootPackagePath);
	const rootLock = readJsonRecord(rootLockPath);
	const preflightPackage = readPackageConfig(preflightPackagePath);
	const preflightWranglerSource = readFileSync(preflightWranglerPath, 'utf8');
	const preflightTsconfig = readTsconfig(preflightTsconfigPath);
	const preflightScriptsTsconfig = readJsonRecord(preflightScriptsTsconfigPath);
	const preflightE2eTsconfig = readJsonRecord(preflightE2eTsconfigPath);
	const preflightMcpPackage = readPackageConfig(preflightMcpPackagePath);
	const preflightMcpTsconfig = readTsconfig(preflightMcpTsconfigPath);
	const deploylintSharedPackage = readPackageConfig(deploylintSharedPackagePath);
	const deploylintSharedTsconfig = readTsconfig(deploylintSharedTsconfigPath);
	const oxlint = readOxlintConfig(oxlintPath);
	const oxfmt = readJsonRecord(oxfmtPath);
	const knip = readKnipConfig(knipPath);
	const configuredCoverageThresholds = readCoverageThresholds(viteConfigPath);
	const configuredScopedCoverageThresholds = readScopedCoverageThresholds(viteConfigPath);
	const configuredMcpCoverageThresholds = readCoverageThresholds(mcpViteConfigPath);
	const configuredSharedCoverageThresholds = readCoverageThresholds(deploylintSharedViteConfigPath);
	const viteConfigSource = readFileSync(viteConfigPath, 'utf8');
	const mcpViteConfigSource = readFileSync(mcpViteConfigPath, 'utf8');
	const deploylintSharedViteConfigSource = readFileSync(deploylintSharedViteConfigPath, 'utf8');
	const localGateScriptSource = readFileSync(localGateScriptPath, 'utf8');
	const remoteGateScriptSource = readFileSync(remoteGateScriptPath, 'utf8');
	const rootSvelteConfigSource = readFileSync(rootSvelteConfigPath, 'utf8');
	const dependabotSource = readFileSync(dependabotPath, 'utf8');
	const playwrightConfig = readFileSync(playwrightConfigPath, 'utf8');
	const deploylintGateAction = readFileSync(deploylintGateActionPath, 'utf8');
	const preflightGateWorkflow = readFileSync(preflightGateWorkflowPath, 'utf8');
	const dogfoodWorkflow = readFileSync(dogfoodWorkflowPath, 'utf8');
	const preflightGateWorkflowConfig = readYamlRecord(preflightGateWorkflowPath);
	const dogfoodWorkflowConfig = readYamlRecord(dogfoodWorkflowPath);
	const disabledTests = findDisabledTestModifiers(rootDir);
	const nvmrcMajor = Number.parseInt(readFileSync(nvmrcPath, 'utf8').trim(), 10);
	const preflightTypeAwareLint = preflightPackage.scripts['lint:type-aware'] ?? '';
	const mcpTypeAwareLint = preflightMcpPackage.scripts['lint:type-aware'] ?? '';
	const mcpProdTypeAwareLint = preflightMcpPackage.scripts['lint:type-aware:prod'] ?? '';
	const sharedTypeAwareLint = deploylintSharedPackage.scripts['lint:type-aware'] ?? '';
	const sharedProdTypeAwareLint = deploylintSharedPackage.scripts['lint:type-aware:prod'] ?? '';

	pushCheck(
		checked,
		failures,
		'preflight scripts run oxfmt, oxlint, and type-aware oxlint with zero-warning lint',
		hasScriptCommand(preflightPackage.scripts, 'lint', ['oxfmt --check .', 'oxlint']) &&
			hasScriptCommand(preflightPackage.scripts, 'lint:type-aware', ['oxlint', '--type-aware']) &&
			(preflightPackage.scripts.lint.includes('--max-warnings=0') ||
				oxlint.options.maxWarnings === 0 ||
				oxlint.options.denyWarnings === true)
	);
	pushCheck(
		checked,
		failures,
		'preflight type-aware Oxlint keeps deprecated API checks enabled',
		hasScriptCommand(preflightPackage.scripts, 'lint:type-aware', ['oxlint', '--type-aware']) &&
			!preflightTypeAwareLint.includes('typescript/no-deprecated')
	);
	pushCheck(
		checked,
		failures,
		'preflight type-aware Oxlint rejects unnecessary type assertions',
		hasScriptCommand(preflightPackage.scripts, 'lint:type-aware', ['oxlint', '--type-aware']) &&
			!preflightTypeAwareLint.includes('typescript/no-unnecessary-type-assertion')
	);
	pushCheck(
		checked,
		failures,
		'preflight verify runs standards, typecheck, lint, type-aware lint, coverage, and build',
		hasScriptCommand(preflightPackage.scripts, 'verify', [
			'quality:standards',
			'sync:gate-remote:check',
			'check',
			'check:scripts',
			'check:e2e',
			'lint',
			'lint:type-aware',
			'lint:type-aware:prod',
			'test:coverage',
			'build'
		])
	);
	pushCheck(
		checked,
		failures,
		'preflight verify typechecks scripts and Playwright E2E specs',
		hasScriptCommand(preflightPackage.scripts, 'check:scripts', [
			'tsc --noEmit -p tsconfig.scripts.json'
		]) &&
			hasScriptCommand(preflightPackage.scripts, 'check:e2e', [
				'tsc --noEmit -p tsconfig.e2e.json'
			]) &&
			hasScriptCommand(preflightPackage.scripts, 'verify', ['check:scripts', 'check:e2e']) &&
			readStringArray(preflightScriptsTsconfig.include).includes('scripts/**/*.ts') &&
			!readStringArray(preflightScriptsTsconfig.include).includes('scripts/**/*.mjs') &&
			readStringArray(preflightE2eTsconfig.include).includes('e2e/**/*.ts')
	);
	pushCheck(
		checked,
		failures,
		'preflight verify validates D1 migrations before build and deploy',
		hasScriptCommand(preflightPackage.scripts, 'check:migrations', [
			'node scripts/check-d1-migrations.mjs'
		]) &&
			hasScriptCommand(preflightPackage.scripts, 'migrations:apply:remote', [
				'wrangler d1 migrations apply preflight-auth --remote'
			]) &&
			hasScriptCommand(preflightPackage.scripts, 'verify', [
				'check:migrations',
				'test:coverage',
				'build'
			]) &&
			hasScriptCommand(preflightPackage.scripts, 'deploy', [
				'sync:gate-remote',
				'check:migrations',
				'build',
				'migrations:apply:remote',
				'wrangler deploy'
			]) &&
			preflightWranglerSource.includes('"binding": "AUTH_DB"') &&
			preflightWranglerSource.includes('"database_name": "preflight-auth"') &&
			preflightWranglerSource.includes('"migrations_dir": "migrations"')
	);
	pushCheck(
		checked,
		failures,
		'preflight production type-aware Oxlint rejects unsafe type assertions',
		hasScriptCommand(preflightPackage.scripts, 'lint:type-aware:prod', [
			'oxlint',
			'--type-aware',
			'--deny typescript/no-unsafe-type-assertion',
			'--ignore-pattern "**/*.test.ts"',
			'--ignore-pattern "**/*.spec.ts"',
			'--ignore-pattern "e2e/**"',
			'--ignore-pattern "scripts/**"'
		]) && !hasRuleLevelOxlintAllowance(preflightPackage.scripts['lint:type-aware:prod'] ?? '')
	);
	pushCheck(
		checked,
		failures,
		'preflight-mcp verify runs typecheck, lint, type-aware lint, clean build, and coverage',
		hasScriptCommand(preflightMcpPackage.scripts, 'verify', [
			'check',
			'lint',
			'lint:type-aware',
			'lint:type-aware:prod',
			'build',
			'test:coverage'
		]) &&
			hasScriptCommand(preflightMcpPackage.scripts, 'build', ['npm run clean', 'tsc']) &&
			hasScriptCommand(preflightMcpPackage.scripts, 'lint:type-aware', ['oxlint', '--type-aware'])
	);
	pushCheck(
		checked,
		failures,
		'preflight-mcp production type-aware Oxlint rejects unsafe type assertions',
		hasScriptCommand(preflightMcpPackage.scripts, 'lint:type-aware:prod', [
			'oxlint',
			'--type-aware',
			'--deny typescript/no-unsafe-type-assertion',
			'--ignore-pattern "**/*.test.ts"'
		]) && !hasRuleLevelOxlintAllowance(mcpProdTypeAwareLint)
	);
	pushCheck(
		checked,
		failures,
		'deploylint-shared verify runs typecheck, lint, type-aware lint, coverage, and syntax checks',
		hasScriptCommand(deploylintSharedPackage.scripts, 'verify', [
			'check',
			'lint',
			'lint:type-aware',
			'lint:type-aware:prod',
			'test:coverage'
		]) &&
			hasScriptCommand(deploylintSharedPackage.scripts, 'check', [
				'tsc --noEmit -p tsconfig.json',
				'node --check index.js'
			]) &&
			hasScriptCommand(deploylintSharedPackage.scripts, 'lint:type-aware', [
				'oxlint',
				'--type-aware'
			]) &&
			hasScriptCommand(deploylintSharedPackage.scripts, 'test:coverage', [
				'vitest run --coverage'
			]) &&
			deploylintSharedPackage.devDependencies.vitest !== undefined &&
			deploylintSharedPackage.devDependencies['@vitest/coverage-v8'] !== undefined &&
			deploylintSharedPackage.devDependencies.typescript !== undefined
	);
	pushCheck(
		checked,
		failures,
		'deploylint-shared production type-aware Oxlint rejects unsafe type assertions',
		hasScriptCommand(deploylintSharedPackage.scripts, 'lint:type-aware:prod', [
			'oxlint',
			'--type-aware',
			'--deny typescript/no-unsafe-type-assertion',
			'--ignore-pattern "**/*.test.js"',
			'--ignore-pattern "**/*.test.ts"'
		]) && !hasRuleLevelOxlintAllowance(sharedProdTypeAwareLint)
	);
	pushCheck(
		checked,
		failures,
		'MCP and shared type-aware Oxlint run without rule-level allowances',
		[mcpTypeAwareLint, sharedTypeAwareLint].every(
			(command) =>
				command.includes('oxlint') &&
				command.includes('--type-aware') &&
				!hasRuleLevelOxlintAllowance(command)
		)
	);
	pushCheck(
		checked,
		failures,
		'root runtime pins Node and npm for deterministic installs',
		rootPackage.packageManager?.startsWith('npm@') === true &&
			/^npm@\d+\.\d+\.\d+$/.test(rootPackage.packageManager) &&
			rootLock.lockfileVersion === 3 &&
			rootPackage.engines?.node?.includes('>=22') === true &&
			Number.isFinite(nvmrcMajor) &&
			nvmrcMajor >= 22
	);
	pushCheck(
		checked,
		failures,
		'Deploylint TypeScript configs keep strict compiler settings',
		preflightTsconfig.compilerOptions?.strict === true &&
			preflightTsconfig.compilerOptions?.checkJs === true &&
			preflightTsconfig.compilerOptions?.forceConsistentCasingInFileNames === true &&
			preflightTsconfig.compilerOptions?.moduleResolution === 'bundler' &&
			preflightMcpTsconfig.compilerOptions?.strict === true &&
			preflightMcpTsconfig.compilerOptions?.declaration === true &&
			preflightMcpTsconfig.compilerOptions?.moduleResolution === 'NodeNext' &&
			preflightMcpTsconfig.compilerOptions?.target === 'ES2023' &&
			deploylintSharedTsconfig.compilerOptions?.strict === true &&
			deploylintSharedTsconfig.compilerOptions?.checkJs === true &&
			deploylintSharedTsconfig.compilerOptions?.moduleResolution === 'NodeNext' &&
			deploylintSharedTsconfig.compilerOptions?.skipLibCheck === false
	);
	pushCheck(
		checked,
		failures,
		'root dependency audit fails on any known vulnerability',
		hasScriptCommand(rootPackage.scripts, 'audit:security', ['npm audit', '--audit-level=low'])
	);
	pushCheck(
		checked,
		failures,
		'root npm registry signature audit verifies lockfile package integrity',
		hasScriptCommand(rootPackage.scripts, 'audit:signatures', ['npm audit signatures']) &&
			hasScriptCommand(rootPackage.scripts, 'verify:deploylint:ci', [
				'npm run audit:security',
				'npm run audit:signatures'
			]) &&
			workflowRunStepIncludes(
				workflowJobSteps(workflowJob(dogfoodWorkflowConfig, 'gate')),
				'Verify npm registry signatures',
				['npm run audit:signatures']
			)
	);
	pushCheck(
		checked,
		failures,
		'root workflow semantic lint runs pinned actionlint across GitHub Actions workflows',
		rootPackage.devDependencies['github-actionlint'] === '1.7.12' &&
			rootPackage.devDependencies.yaml === '2.9.0' &&
			hasScriptCommand(rootPackage.scripts, 'lint:workflows', ['github-actionlint']) &&
			hasScriptCommand(rootPackage.scripts, 'verify:deploylint:ci', ['npm run lint:workflows']) &&
			hasScriptCommand(rootPackage.scripts, 'verify:deploylint:local', [
				'npm run lint:workflows'
			]) &&
			hasScriptCommand(rootPackage.scripts, 'verify:tcg-vault:ci', ['npm run lint:workflows'])
	);
	pushCheck(
		checked,
		failures,
		'Dependabot updates npm and GitHub Actions supply-chain dependencies',
		hasWeeklyDependabotUpdate(dependabotSource, 'npm') &&
			hasWeeklyDependabotUpdate(dependabotSource, 'github-actions') &&
			dependabotSource.includes('labels:') &&
			dependabotSource.includes('ci-hardening')
	);
	pushCheck(
		checked,
		failures,
		'Deploylint gate scripts bound network calls with timeout and retry controls',
		hasBoundedGateFetch(localGateScriptSource) && hasBoundedGateFetch(remoteGateScriptSource)
	);
	pushCheck(
		checked,
		failures,
		'Deploylint GitHub Action exposes gate timeout and retry controls',
		hasActionBoundedFetchInputs(deploylintGateAction)
	);
	pushCheck(
		checked,
		failures,
		'root deploylint CI verify runs audit, shared, preflight, mcp, Playwright install, and e2e',
		hasScriptCommand(rootPackage.scripts, 'verify:deploylint:ci', [
			'npm run audit:security',
			'npm run format:deploylint:check',
			'npm run verify -w apps/deploylint-shared',
			'npm run verify -w preflight',
			'npm run verify -w preflight-mcp',
			'npm run test:e2e:install -w preflight',
			'npm run test:e2e -w preflight -- --forbid-only'
		])
	);
	pushCheck(
		checked,
		failures,
		'root preflight verify alias runs full unit, build, and E2E gate',
		hasScriptCommand(rootPackage.scripts, 'verify:preflight', ['npm run verify:preflight:full']) &&
			hasScriptCommand(rootPackage.scripts, 'verify:preflight:unit', [
				'turbo run verify',
				'--filter=preflight'
			]) &&
			hasScriptCommand(rootPackage.scripts, 'verify:preflight:full', [
				'npm run verify:preflight:unit',
				'npm run test:e2e -w preflight -- --forbid-only'
			])
	);
	pushCheck(
		checked,
		failures,
		'root deploylint local verify runs offline format, dead-code, unit, build, and E2E gates',
		hasScriptCommand(rootPackage.scripts, 'verify:deploylint:local', [
			'npm run lint:workflows',
			'npm run format:deploylint:check',
			'npm run deadcode:deploylint',
			'npm run verify -w apps/deploylint-shared',
			'npm run verify -w preflight',
			'npm run verify -w preflight-mcp',
			'npm run test:e2e -w preflight -- --forbid-only'
		]) &&
			!rootPackage.scripts['verify:deploylint:local']?.includes('npm audit') &&
			!rootPackage.scripts['verify:deploylint:local']?.includes('test:e2e:install')
	);
	pushCheck(
		checked,
		failures,
		'root deploylint format gate checks root dependency configs and workflows',
		hasScriptCommand(rootPackage.scripts, 'format:deploylint:check', [
			'oxfmt --check',
			'package.json',
			'package-lock.json',
			'turbo.json',
			'knip.deploylint.jsonc',
			'renovate.json',
			'.oxlintrc.jsonc',
			'.oxfmtrc.jsonc',
			'svelte.config.js',
			'.github/dependabot.yml',
			'.github/workflows/preflight-gate.yml',
			'.github/workflows/deploylint-dogfood.yml',
			'.github/workflows/tcg-vault-gate.yml',
			'.github/actions/deploylint-gate/action.yml',
			'.github/actions/deploylint-gate/gate-remote.mjs',
			'scripts/assert-unlighthouse.mjs',
			'scripts/benchmark-lighthouse.mjs'
		]) && rootPackage.scripts['verify:deploylint:ci']?.includes('npm run format:deploylint:check')
	);
	pushCheck(
		checked,
		failures,
		'root dead-code gate runs knip against Deploylint workspaces',
		hasScriptCommand(rootPackage.scripts, 'deadcode:deploylint', [
			'knip',
			'knip.deploylint.jsonc',
			'--workspace apps/preflight',
			'--workspace apps/preflight-mcp',
			'--workspace apps/deploylint-shared',
			'--no-progress',
			'--treat-config-hints-as-errors',
			'--max-issues=0'
		]) &&
			rootPackage.devDependencies.knip !== undefined &&
			rootPackage.devDependencies['oxlint-tsgolint'] !== undefined &&
			rootPackage.scripts['verify:deploylint:ci']?.includes('npm run deadcode:deploylint') &&
			['apps/deploylint-shared', 'apps/preflight', 'apps/preflight-mcp'].every((workspace) =>
				Object.hasOwn(knip.workspaces, workspace)
			)
	);
	pushCheck(
		checked,
		failures,
		'Deploylint dead-code gate uses workspace-scoped SvelteKit config',
		hasWorkspaceScopedSvelteKitConfig(knip, 'apps/preflight', 'svelte.config.js')
	);
	pushCheck(
		checked,
		failures,
		'root SvelteKit tooling shim is dependency-free for Knip',
		rootSvelteConfigSource.includes('module.exports') &&
			rootSvelteConfigSource.includes('kit: {}') &&
			!rootSvelteConfigSource.includes('@sveltejs/adapter')
	);
	pushCheck(
		checked,
		failures,
		'root deploylint ship verify adds production smoke',
		hasScriptCommand(rootPackage.scripts, 'verify:deploylint', [
			'npm run verify:deploylint:ci',
			'npm run smoke:preflight'
		])
	);
	pushCheck(
		checked,
		failures,
		'root Deploylint benchmark scripts pin Unlighthouse CI tooling',
		hasPinnedUnlighthouseCommand(rootPackage.scripts['bench:site'] ?? '', 'unlighthouse') &&
			hasPinnedUnlighthouseCommand(rootPackage.scripts['bench:site:ci'] ?? '', 'unlighthouse-ci') &&
			hasScriptCommand(rootPackage.scripts, 'bench:site', ['--exclude-urls /app,/login.*']) &&
			hasScriptCommand(rootPackage.scripts, 'bench:site:ci', [
				'--site https://deploylint.com',
				'--desktop',
				'--samples 1',
				'--budget 80',
				'--exclude-urls /app,/login.*',
				'--build-static',
				'--output-path tmp/unlighthouse',
				'node scripts/assert-unlighthouse.mjs'
			])
	);
	pushCheck(
		checked,
		failures,
		'oxlint config enables correctness, suspicious, TypeScript, Vitest, Promise, and Unicorn guards',
		oxlint.categories.correctness === 'error' &&
			oxlint.categories.suspicious === 'error' &&
			oxlint.options.denyWarnings === true &&
			oxlint.options.maxWarnings === 0 &&
			oxlint.options.reportUnusedDisableDirectives === 'error' &&
			['typescript', 'vitest', 'promise', 'unicorn', 'import'].every((plugin) =>
				oxlint.plugins.includes(plugin)
			) &&
			oxlint.rules['no-debugger'] === 'error' &&
			oxlint.rules['typescript/no-explicit-any'] === 'error' &&
			oxlint.rules['typescript/no-floating-promises'] === 'error' &&
			oxlint.rules['vitest/no-focused-tests'] === 'error' &&
			oxlint.rules['vitest/expect-expect'] === 'error'
	);
	pushCheck(
		checked,
		failures,
		'oxfmt config enforces deterministic imports, Tailwind sorting, Svelte formatting, and LF endings',
		oxfmt.sortImports === true &&
			oxfmt.sortTailwindcss === true &&
			oxfmt.svelte === true &&
			oxfmt.endOfLine === 'lf' &&
			oxfmt.useTabs === true
	);
	pushCheck(
		checked,
		failures,
		'vitest coverage thresholds meet enterprise minimums',
		coverageThresholdsMeet(configuredCoverageThresholds, ENTERPRISE_COVERAGE_MINIMUMS)
	);
	pushCheck(
		checked,
		failures,
		'vitest scoped coverage thresholds protect critical Deploylint folders',
		includesScopedThresholds(configuredScopedCoverageThresholds, CRITICAL_COVERAGE_THRESHOLDS)
	);
	pushCheck(
		checked,
		failures,
		'vitest coverage includes SvelteKit server route entrypoints',
		[
			'src/routes/**/+server.{ts,js}',
			'src/routes/**/+page.server.{ts,js}',
			'src/routes/**/+layout.server.{ts,js}'
		].every((pattern) => viteConfigSource.includes(pattern))
	);
	pushCheck(
		checked,
		failures,
		'vitest coverage includes client funnel telemetry',
		!viteConfigSource.includes("'src/lib/client/track.ts'") &&
			!viteConfigSource.includes('"src/lib/client/track.ts"')
	);
	pushCheck(
		checked,
		failures,
		'Vitest configs fail when no tests are discovered',
		[viteConfigPath, mcpViteConfigPath, deploylintSharedViteConfigPath].every(
			(configPath) => readBooleanConfigProperty(configPath, 'passWithNoTests') === false
		)
	);
	pushCheck(
		checked,
		failures,
		'Vitest configs reject focused tests in every environment',
		[viteConfigPath, mcpViteConfigPath, deploylintSharedViteConfigPath].every(
			(configPath) => readBooleanConfigProperty(configPath, 'allowOnly') === false
		)
	);
	pushCheck(
		checked,
		failures,
		'preflight-mcp coverage thresholds meet enterprise minimums',
		coverageThresholdsMeet(configuredMcpCoverageThresholds, ENTERPRISE_COVERAGE_MINIMUMS)
	);
	pushCheck(
		checked,
		failures,
		'deploylint-shared coverage thresholds meet enterprise minimums',
		coverageThresholdsMeet(configuredSharedCoverageThresholds, ENTERPRISE_COVERAGE_MINIMUMS)
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows use parsed triggers for deterministic CI and production dogfood',
		hasDeploylintCiWorkflowTriggers(preflightGateWorkflowConfig) &&
			hasDeploylintDogfoodWorkflowTriggers(dogfoodWorkflowConfig)
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows enforce canonical deploylint CI and MCP dogfood gates',
		hasPreflightGateWorkflowContract(preflightGateWorkflowConfig) &&
			hasDogfoodWorkflowContract(dogfoodWorkflowConfig)
	);
	pushCheck(
		checked,
		failures,
		'GitHub dogfood runs production smoke and benchmark gates',
		workflowRunStepIncludes(
			workflowJobSteps(workflowJob(dogfoodWorkflowConfig, 'gate')),
			'Smoke deploylint.com',
			['npm run smoke:preflight']
		) &&
			workflowRunStepIncludes(
				workflowJobSteps(workflowJob(dogfoodWorkflowConfig, 'gate')),
				'Benchmark deploylint.com',
				['npm run bench:site:ci']
			) &&
			hasArtifactUploadStep(
				workflowJobSteps(workflowJob(dogfoodWorkflowConfig, 'gate')),
				'Upload dogfood failure artifacts',
				['tmp/unlighthouse/**']
			)
	);
	pushCheck(
		checked,
		failures,
		'GitHub push CI fails when production gate URL is missing',
		workflowRunStepIncludes(
			workflowJobSteps(workflowJob(preflightGateWorkflowConfig, 'gate')),
			'Require production gate URL on main pushes',
			['::error::Set PREFLIGHT_GATE_URL or DEPLOYLINT_GATE_URL', 'exit 2']
		) &&
			workflowStepByName(
				workflowJobSteps(workflowJob(preflightGateWorkflowConfig, 'gate')),
				'Require production gate URL on main pushes'
			)?.if === "github.event_name == 'push'" &&
			workflowStepByName(
				workflowJobSteps(workflowJob(preflightGateWorkflowConfig, 'gate')),
				'Scan production URL'
			) !== null
	);
	pushCheck(
		checked,
		failures,
		'GitHub pull request CI runs dependency review for supply-chain diffs',
		workflowJob(preflightGateWorkflowConfig, 'dependency-review').if ===
			"github.event_name == 'pull_request'" &&
			workflowUsesStep(
				workflowJobSteps(workflowJob(preflightGateWorkflowConfig, 'dependency-review')),
				PINNED_WORKFLOW_ACTIONS.dependencyReview
			) &&
			workflowStepWith(
				workflowJobSteps(workflowJob(preflightGateWorkflowConfig, 'dependency-review')).find(
					(step) => step.uses === PINNED_WORKFLOW_ACTIONS.dependencyReview
				) ?? {}
			)['fail-on-severity'] === 'moderate'
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows pin external actions to full commit SHAs',
		[
			preflightGateWorkflowConfig,
			dogfoodWorkflowConfig,
			readYamlRecord(tcgVaultWorkflowPath)
		].every(workflowExternalActionUsesAreShaPinned)
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows use lockfile installs and npm dependency caching',
		[preflightGateWorkflowConfig, dogfoodWorkflowConfig].every((workflow) => {
			const steps = workflowJobSteps(workflowJob(workflow, 'gate'));
			return (
				hasSetupNodeStep(steps) &&
				workflowRunStepIncludes(steps, 'Install dependencies', ['npm ci'])
			);
		})
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows declare least-privilege token permissions',
		hasLeastPrivilegeWorkflowPermissions(preflightGateWorkflow) &&
			hasLeastPrivilegeWorkflowPermissions(dogfoodWorkflow)
	);
	pushCheck(
		checked,
		failures,
		'Playwright CI captures screenshots, videos, traces, junit, and html failure reports',
		playwrightConfig.includes("trace: 'on-first-retry'") &&
			playwrightConfig.includes("screenshot: 'only-on-failure'") &&
			playwrightConfig.includes("video: 'on-first-retry'") &&
			playwrightConfig.includes("['junit', { outputFile: 'test-results/playwright-junit.xml' }]") &&
			playwrightConfig.includes("['html', { open: 'never' }]") &&
			hasArtifactUploadStep(
				workflowJobSteps(workflowJob(preflightGateWorkflowConfig, 'gate')),
				'Upload Deploylint failure artifacts',
				['apps/preflight/playwright-report/**', 'apps/preflight/test-results/**']
			)
	);
	pushCheck(
		checked,
		failures,
		'Playwright config forbids focused local and CI tests and isolates CI server state',
		playwrightConfig.includes('forbidOnly: true') &&
			playwrightConfig.includes('retries: process.env.CI ? 1 : 0') &&
			playwrightConfig.includes('workers: process.env.CI ? 1 : undefined') &&
			playwrightConfig.includes("DEPLOYLINT_PLATFORM_PROXY_CONFIG: 'wrangler.e2e.jsonc'") &&
			playwrightConfig.includes("baseURL: 'http://localhost:4299'") &&
			playwrightConfig.includes('reuseExistingServer: false')
	);
	pushCheck(
		checked,
		failures,
		'Deploylint unit and E2E specs cannot contain focused, disabled, or placeholder tests',
		disabledTests.length === 0
	);
	pushCheck(
		checked,
		failures,
		'Vitest CI captures junit test-result artifacts for preflight, MCP, and shared packages',
		hasVitestJUnitArtifacts(viteConfigSource) &&
			hasVitestJUnitArtifacts(mcpViteConfigSource) &&
			hasVitestJUnitArtifacts(deploylintSharedViteConfigSource) &&
			hasArtifactUploadStep(
				workflowJobSteps(workflowJob(preflightGateWorkflowConfig, 'gate')),
				'Upload Deploylint failure artifacts',
				[
					'apps/deploylint-shared/test-results/**',
					'apps/preflight/test-results/**',
					'apps/preflight-mcp/test-results/**'
				]
			)
	);
	pushCheck(
		checked,
		failures,
		'quality standards script is runnable from npm',
		hasScriptCommand(preflightPackage.scripts, 'quality:standards', [
			'tsx src/lib/quality/standards.ts'
		])
	);
	return {
		checked,
		failures,
		coverageThresholds: configuredCoverageThresholds
	};
}

export function assertQualityStandards(rootDir = repoRoot) {
	const report = inspectQualityStandards(rootDir);
	if (report.failures.length > 0) {
		throw new Error(`Quality standards failed:\n- ${report.failures.join('\n- ')}`);
	}
	return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const report = assertQualityStandards();
	console.log(`quality standards passed (${report.checked.length} checks)`);
}
