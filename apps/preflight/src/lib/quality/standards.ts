import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

function hasScriptCommand(
	scripts: Record<string, string>,
	scriptName: string,
	fragments: string[]
) {
	const command = scripts[scriptName] ?? '';
	return fragments.every((fragment) => command.includes(fragment));
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

export function inspectQualityStandards(rootDir = repoRoot): QualityStandardsReport {
	const preflightRoot = join(rootDir, 'apps/preflight');
	const preflightMcpRoot = join(rootDir, 'apps/preflight-mcp');
	const deploylintSharedRoot = join(rootDir, 'apps/deploylint-shared');
	const rootPackagePath = join(rootDir, 'package.json');
	const rootLockPath = join(rootDir, 'package-lock.json');
	const preflightPackagePath = join(preflightRoot, 'package.json');
	const preflightMcpPackagePath = join(preflightMcpRoot, 'package.json');
	const deploylintSharedPackagePath = join(deploylintSharedRoot, 'package.json');
	const deploylintSharedTsconfigPath = join(deploylintSharedRoot, 'tsconfig.json');
	const deploylintSharedViteConfigPath = join(deploylintSharedRoot, 'vitest.config.ts');
	const oxlintPath = join(rootDir, '.oxlintrc.jsonc');
	const oxfmtPath = join(rootDir, '.oxfmtrc.jsonc');
	const nvmrcPath = join(rootDir, '.nvmrc');
	const knipPath = join(rootDir, 'knip.deploylint.jsonc');
	const viteConfigPath = join(preflightRoot, 'vite.config.ts');
	const mcpViteConfigPath = join(preflightMcpRoot, 'vite.config.ts');
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
		preflightMcpPackagePath,
		deploylintSharedPackagePath,
		deploylintSharedTsconfigPath,
		deploylintSharedViteConfigPath,
		oxlintPath,
		oxfmtPath,
		nvmrcPath,
		knipPath,
		viteConfigPath,
		mcpViteConfigPath,
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
	};
	const preflightPackage = readJson(preflightPackagePath) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	const preflightMcpPackage = readJson(preflightMcpPackagePath) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	const deploylintSharedPackage = readJson(deploylintSharedPackagePath) as {
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	};
	const oxlint = readJson(oxlintPath) as {
		categories: Record<string, string>;
		options: Record<string, string | number | boolean>;
		plugins: string[];
		rules: Record<string, string>;
	};
	const oxfmt = readJson(oxfmtPath) as Record<string, unknown>;
	const knip = readJson(knipPath) as {
		workspaces: Record<string, unknown>;
	};
	const configuredCoverageThresholds = readCoverageThresholds(viteConfigPath);
	const configuredScopedCoverageThresholds = readScopedCoverageThresholds(viteConfigPath);
	const configuredMcpCoverageThresholds = readCoverageThresholds(mcpViteConfigPath);
	const configuredSharedCoverageThresholds = readCoverageThresholds(deploylintSharedViteConfigPath);
	const preflightGateWorkflow = readFileSync(preflightGateWorkflowPath, 'utf8');
	const dogfoodWorkflow = readFileSync(dogfoodWorkflowPath, 'utf8');

	pushCheck(
		checked,
		failures,
		'preflight scripts run oxfmt, oxlint, and type-aware oxlint with zero-warning lint',
		hasScriptCommand(preflightPackage.scripts, 'lint', ['oxfmt --check .', 'oxlint']) &&
			hasScriptCommand(preflightPackage.scripts, 'lint:type-aware', [
				'oxlint',
				'--type-aware',
				'typescript/no-unsafe-type-assertion'
			]) &&
			(preflightPackage.scripts.lint.includes('--max-warnings=0') ||
				oxlint.options.maxWarnings === 0 ||
				oxlint.options.denyWarnings === true)
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
		'preflight-mcp verify runs typecheck, lint, type-aware lint, coverage, and build',
		hasScriptCommand(preflightMcpPackage.scripts, 'verify', [
			'check',
			'lint',
			'lint:type-aware',
			'test:coverage',
			'build'
		]) &&
			hasScriptCommand(preflightMcpPackage.scripts, 'lint:type-aware', [
				'oxlint',
				'--type-aware',
				'typescript/no-unsafe-type-assertion'
			])
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
				'--type-aware',
				'typescript/no-unsafe-type-assertion'
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
		'root dependency audit fails on any known vulnerability',
		hasScriptCommand(rootPackage.scripts, 'audit:security', ['npm audit', '--audit-level=low'])
	);
	pushCheck(
		checked,
		failures,
		'root deploylint CI verify runs audit, shared, preflight, mcp, Playwright install, and e2e',
		hasScriptCommand(rootPackage.scripts, 'verify:deploylint:ci', [
			'npm run audit:security',
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
		'GitHub workflows enforce canonical deploylint CI and MCP dogfood gates',
		preflightGateWorkflow.includes('npm run verify:deploylint:ci') &&
			preflightGateWorkflow.includes('push:') &&
			preflightGateWorkflow.includes('branches: [main]') &&
			preflightGateWorkflow.includes('node-version-file: .nvmrc') &&
			preflightGateWorkflow.includes('actions/upload-artifact@v6') &&
			preflightGateWorkflow.includes('apps/deploylint-shared/coverage/**') &&
			preflightGateWorkflow.includes('apps/preflight/coverage/**') &&
			preflightGateWorkflow.includes('apps/preflight/playwright-report/**') &&
			preflightGateWorkflow.includes('apps/preflight-mcp/coverage/**') &&
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
		'GitHub workflows declare least-privilege token permissions',
		hasLeastPrivilegeWorkflowPermissions(preflightGateWorkflow) &&
			hasLeastPrivilegeWorkflowPermissions(dogfoodWorkflow)
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
