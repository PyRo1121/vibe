import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { analyzeWorkflowPermissions } from '../ci/workflow-permissions';

export const ENTERPRISE_COVERAGE_MINIMUMS = {
	statements: 95,
	lines: 95,
	functions: 98,
	branches: 90
} as const;

type CoverageThresholds = Record<keyof typeof ENTERPRISE_COVERAGE_MINIMUMS, number>;
type ScopedCoverageThresholds = Record<string, CoverageThresholds>;

const DISABLED_TEST_MODIFIERS = new Set(['only', 'skip', 'fixme']);

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
		branches: 84
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
	return listSourceFiles(join(rootDir, 'apps/preflight/e2e')).flatMap((path) => {
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
		if (!name || !(name in ENTERPRISE_COVERAGE_MINIMUMS)) continue;
		values[name as keyof CoverageThresholds] = Number(prop.initializer.text);
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
			if (!thresholdName || !(thresholdName in ENTERPRISE_COVERAGE_MINIMUMS)) continue;
			values[thresholdName as keyof CoverageThresholds] = Number(thresholdProp.initializer.text);
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
			Object.entries(thresholds).every(
				([metric, minimum]) => configured[metric as keyof CoverageThresholds] >= minimum
			)
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

function hasDeploylintWorkflowTriggers(workflow: string): boolean {
	return (
		workflow.includes('push:') &&
		workflow.includes('branches: [main]') &&
		workflow.includes('pull_request:') &&
		workflow.includes('workflow_dispatch:') &&
		[
			'apps/preflight/**',
			'apps/preflight-mcp/**',
			'apps/deploylint-shared/**',
			'.github/actions/deploylint-gate/**',
			'package.json',
			'package-lock.json',
			'turbo.json',
			'knip.deploylint.jsonc',
			'.oxlintrc.jsonc',
			'.oxfmtrc.jsonc',
			'.nvmrc',
			'.github/workflows/preflight-gate.yml',
			'.github/workflows/deploylint-dogfood.yml'
		].every((path) => workflow.includes(path))
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

export function inspectQualityStandards(rootDir = repoRoot): QualityStandardsReport {
	const preflightRoot = join(rootDir, 'apps/preflight');
	const preflightMcpRoot = join(rootDir, 'apps/preflight-mcp');
	const deploylintSharedRoot = join(rootDir, 'apps/deploylint-shared');
	const rootPackagePath = join(rootDir, 'package.json');
	const rootLockPath = join(rootDir, 'package-lock.json');
	const preflightPackagePath = join(preflightRoot, 'package.json');
	const preflightTsconfigPath = join(preflightRoot, 'tsconfig.json');
	const preflightMcpPackagePath = join(preflightMcpRoot, 'package.json');
	const preflightMcpTsconfigPath = join(preflightMcpRoot, 'tsconfig.json');
	const deploylintSharedPackagePath = join(deploylintSharedRoot, 'package.json');
	const deploylintSharedTsconfigPath = join(deploylintSharedRoot, 'tsconfig.json');
	const deploylintSharedViteConfigPath = join(deploylintSharedRoot, 'vitest.config.ts');
	const localGateScriptPath = join(preflightRoot, 'scripts/gate.ts');
	const remoteGateScriptPath = join(preflightRoot, 'scripts/gate-remote.mjs');
	const oxlintPath = join(rootDir, '.oxlintrc.jsonc');
	const oxfmtPath = join(rootDir, '.oxfmtrc.jsonc');
	const rootSvelteConfigPath = join(rootDir, 'svelte.config.js');
	const dependabotPath = join(rootDir, '.github/dependabot.yml');
	const nvmrcPath = join(rootDir, '.nvmrc');
	const knipPath = join(rootDir, 'knip.deploylint.jsonc');
	const viteConfigPath = join(preflightRoot, 'vite.config.ts');
	const mcpViteConfigPath = join(preflightMcpRoot, 'vite.config.ts');
	const playwrightConfigPath = join(preflightRoot, 'playwright.config.ts');
	const preflightGateWorkflowPath = join(rootDir, '.github/workflows/preflight-gate.yml');
	const dogfoodWorkflowPath = join(rootDir, '.github/workflows/deploylint-dogfood.yml');
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
		preflightTsconfigPath,
		preflightMcpPackagePath,
		preflightMcpTsconfigPath,
		deploylintSharedPackagePath,
		deploylintSharedTsconfigPath,
		deploylintSharedViteConfigPath,
		localGateScriptPath,
		remoteGateScriptPath,
		oxlintPath,
		oxfmtPath,
		rootSvelteConfigPath,
		dependabotPath,
		nvmrcPath,
		knipPath,
		viteConfigPath,
		mcpViteConfigPath,
		playwrightConfigPath,
		preflightGateWorkflowPath,
		dogfoodWorkflowPath
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

	const rootPackage = readJson(rootPackagePath) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
		engines?: {
			node?: string;
		};
		packageManager?: string;
	};
	const rootLock = readJson(rootLockPath) as {
		lockfileVersion?: number;
	};
	const preflightPackage = readJson(preflightPackagePath) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	const preflightTsconfig = readJson(preflightTsconfigPath) as {
		compilerOptions?: Record<string, unknown>;
	};
	const preflightMcpPackage = readJson(preflightMcpPackagePath) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	const preflightMcpTsconfig = readJson(preflightMcpTsconfigPath) as {
		compilerOptions?: Record<string, unknown>;
	};
	const deploylintSharedPackage = readJson(deploylintSharedPackagePath) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	const deploylintSharedTsconfig = readJson(deploylintSharedTsconfigPath) as {
		compilerOptions?: Record<string, unknown>;
	};
	const oxlint = readJson(oxlintPath) as {
		categories: Record<string, string>;
		options: Record<string, string | number | boolean>;
		plugins: string[];
		rules: Record<string, string>;
	};
	const oxfmt = readJson(oxfmtPath) as Record<string, unknown>;
	const knip = readJson(knipPath) as {
		sveltekit?: unknown;
		workspaces: Record<string, unknown>;
	};
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
	const preflightGateWorkflow = readFileSync(preflightGateWorkflowPath, 'utf8');
	const dogfoodWorkflow = readFileSync(dogfoodWorkflowPath, 'utf8');
	const disabledE2eTests = findDisabledTestModifiers(rootDir);
	const nvmrcMajor = Number.parseInt(readFileSync(nvmrcPath, 'utf8').trim(), 10);
	const preflightTypeAwareLint = preflightPackage.scripts['lint:type-aware'] ?? '';
	const mcpTypeAwareLint = preflightMcpPackage.scripts['lint:type-aware'] ?? '';
	const sharedTypeAwareLint = deploylintSharedPackage.scripts['lint:type-aware'] ?? '';

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
			'lint',
			'lint:type-aware',
			'test:coverage',
			'build'
		])
	);
	pushCheck(
		checked,
		failures,
		'preflight-mcp verify runs typecheck, lint, type-aware lint, clean build, and coverage',
		hasScriptCommand(preflightMcpPackage.scripts, 'verify', [
			'check',
			'lint',
			'lint:type-aware',
			'build',
			'test:coverage'
		]) &&
			hasScriptCommand(preflightMcpPackage.scripts, 'build', ['npm run clean', 'tsc']) &&
			hasScriptCommand(preflightMcpPackage.scripts, 'lint:type-aware', ['oxlint', '--type-aware'])
	);
	pushCheck(
		checked,
		failures,
		'deploylint-shared verify runs typecheck, lint, type-aware lint, coverage, and syntax checks',
		hasScriptCommand(deploylintSharedPackage.scripts, 'verify', [
			'check',
			'lint',
			'lint:type-aware',
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
		'root deploylint CI verify runs audit, shared, preflight, mcp, Playwright install, and e2e',
		hasScriptCommand(rootPackage.scripts, 'verify:deploylint:ci', [
			'npm run audit:security',
			'npm run format:deploylint:check',
			'npm run verify -w apps/deploylint-shared',
			'npm run verify -w preflight',
			'npm run verify -w preflight-mcp',
			'npm run test:e2e:install -w preflight',
			'npm run test:e2e -w preflight'
		])
	);
	pushCheck(
		checked,
		failures,
		'root deploylint local verify skips network-heavy CI-only gates',
		hasScriptCommand(rootPackage.scripts, 'verify:deploylint:local', [
			'npm run verify -w apps/deploylint-shared',
			'npm run verify -w preflight',
			'npm run verify -w preflight-mcp',
			'npm run test:e2e -w preflight'
		]) &&
			!rootPackage.scripts['verify:deploylint:local']?.includes('npm audit') &&
			!rootPackage.scripts['verify:deploylint:local']?.includes('deadcode:deploylint') &&
			!rootPackage.scripts['verify:deploylint:local']?.includes('test:e2e:install')
	);
	pushCheck(
		checked,
		failures,
		'root deploylint format gate checks root configs and workflows',
		hasScriptCommand(rootPackage.scripts, 'format:deploylint:check', [
			'oxfmt --check',
			'package.json',
			'package-lock.json',
			'turbo.json',
			'knip.deploylint.jsonc',
			'.oxlintrc.jsonc',
			'.oxfmtrc.jsonc',
			'svelte.config.js',
			'.github/dependabot.yml',
			'.github/workflows/preflight-gate.yml',
			'.github/workflows/deploylint-dogfood.yml',
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
		Object.entries(ENTERPRISE_COVERAGE_MINIMUMS).every(
			([metric, minimum]) =>
				configuredCoverageThresholds[metric as keyof CoverageThresholds] >= minimum
		)
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
		Object.entries(ENTERPRISE_COVERAGE_MINIMUMS).every(
			([metric, minimum]) =>
				configuredMcpCoverageThresholds[metric as keyof CoverageThresholds] >= minimum
		)
	);
	pushCheck(
		checked,
		failures,
		'deploylint-shared coverage thresholds meet enterprise minimums',
		Object.entries(ENTERPRISE_COVERAGE_MINIMUMS).every(
			([metric, minimum]) =>
				configuredSharedCoverageThresholds[metric as keyof CoverageThresholds] >= minimum
		)
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows run on push, pull request, and manual dispatch with Deploylint path filters',
		hasDeploylintWorkflowTriggers(preflightGateWorkflow) &&
			hasDeploylintWorkflowTriggers(dogfoodWorkflow)
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows enforce canonical deploylint CI and MCP dogfood gates',
		preflightGateWorkflow.includes('npm run verify:deploylint:ci') &&
			preflightGateWorkflow.includes('concurrency:') &&
			preflightGateWorkflow.includes('cancel-in-progress: true') &&
			preflightGateWorkflow.includes('timeout-minutes: 30') &&
			preflightGateWorkflow.includes('push:') &&
			preflightGateWorkflow.includes('branches: [main]') &&
			preflightGateWorkflow.includes('node-version-file: .nvmrc') &&
			preflightGateWorkflow.includes('actions/upload-artifact@v6') &&
			preflightGateWorkflow.includes('apps/deploylint-shared/coverage/**') &&
			preflightGateWorkflow.includes('apps/deploylint-shared/test-results/**') &&
			preflightGateWorkflow.includes('apps/preflight/coverage/**') &&
			preflightGateWorkflow.includes('apps/preflight/playwright-report/**') &&
			preflightGateWorkflow.includes('apps/preflight/test-results/**') &&
			preflightGateWorkflow.includes('retention-days: 14') &&
			preflightGateWorkflow.includes('apps/preflight-mcp/coverage/**') &&
			preflightGateWorkflow.includes('apps/preflight-mcp/test-results/**') &&
			!preflightGateWorkflow.includes("node-version: '24'") &&
			preflightGateWorkflow.includes('apps/preflight-mcp/**') &&
			[
				'apps/deploylint-shared/**',
				'.github/actions/deploylint-gate/**',
				'knip.deploylint.jsonc',
				'.oxlintrc.jsonc',
				'.oxfmtrc.jsonc',
				'.nvmrc'
			].every((path) => preflightGateWorkflow.includes(path)) &&
			dogfoodWorkflow.includes('push:') &&
			dogfoodWorkflow.includes('branches: [main]') &&
			dogfoodWorkflow.includes('concurrency:') &&
			dogfoodWorkflow.includes('cancel-in-progress: true') &&
			dogfoodWorkflow.includes('timeout-minutes: 20') &&
			dogfoodWorkflow.includes('actions/upload-artifact@v6') &&
			dogfoodWorkflow.includes('apps/preflight-mcp/coverage/**') &&
			dogfoodWorkflow.includes('apps/preflight-mcp/test-results/**') &&
			dogfoodWorkflow.includes('retention-days: 14') &&
			dogfoodWorkflow.includes('npm run verify -w preflight-mcp') &&
			dogfoodWorkflow.includes('node-version-file: .nvmrc') &&
			(dogfoodWorkflow.includes('min_score: "80"') ||
				dogfoodWorkflow.includes("min_score: '80'")) &&
			dogfoodWorkflow.includes('mode: gate') &&
			[
				'apps/deploylint-shared/**',
				'package-lock.json',
				'knip.deploylint.jsonc',
				'.oxlintrc.jsonc',
				'.oxfmtrc.jsonc',
				'.nvmrc'
			].every((path) => dogfoodWorkflow.includes(path))
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows use lockfile installs and npm dependency caching',
		[preflightGateWorkflow, dogfoodWorkflow].every(
			(workflow) =>
				workflow.includes('actions/setup-node@v6') &&
				workflow.includes('node-version-file: .nvmrc') &&
				workflow.includes('cache: npm') &&
				workflow.includes('run: npm ci')
		)
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
			preflightGateWorkflow.includes('apps/preflight/playwright-report/**') &&
			preflightGateWorkflow.includes('apps/preflight/test-results/**')
	);
	pushCheck(
		checked,
		failures,
		'Playwright config forbids focused CI tests and isolates CI server state',
		playwrightConfig.includes('forbidOnly: !!process.env.CI') &&
			playwrightConfig.includes('retries: process.env.CI ? 1 : 0') &&
			playwrightConfig.includes('workers: process.env.CI ? 1 : undefined') &&
			playwrightConfig.includes('reuseExistingServer: !process.env.CI')
	);
	pushCheck(
		checked,
		failures,
		'Playwright E2E specs cannot contain focused or disabled tests',
		disabledE2eTests.length === 0
	);
	pushCheck(
		checked,
		failures,
		'Vitest CI captures junit test-result artifacts for preflight, MCP, and shared packages',
		hasVitestJUnitArtifacts(viteConfigSource) &&
			hasVitestJUnitArtifacts(mcpViteConfigSource) &&
			hasVitestJUnitArtifacts(deploylintSharedViteConfigSource) &&
			preflightGateWorkflow.includes('apps/deploylint-shared/test-results/**') &&
			preflightGateWorkflow.includes('apps/preflight/test-results/**') &&
			preflightGateWorkflow.includes('apps/preflight-mcp/test-results/**')
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
