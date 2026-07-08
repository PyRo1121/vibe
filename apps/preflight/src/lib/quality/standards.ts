import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { analyzeWorkflowPermissions } from '../ci/workflow-permissions';

export const ENTERPRISE_COVERAGE_MINIMUMS = {
	statements: 90,
	lines: 90,
	functions: 95,
	branches: 90
} as const;

type CoverageThresholds = Record<keyof typeof ENTERPRISE_COVERAGE_MINIMUMS, number>;

export interface QualityStandardsReport {
	checked: string[];
	failures: string[];
	coverageThresholds: CoverageThresholds;
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const repoRoot = resolve(appRoot, '../..');

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, 'utf8')) as T;
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
	const rootPackagePath = join(rootDir, 'package.json');
	const rootLockPath = join(rootDir, 'package-lock.json');
	const preflightPackagePath = join(preflightRoot, 'package.json');
	const preflightMcpPackagePath = join(preflightMcpRoot, 'package.json');
	const oxlintPath = join(rootDir, '.oxlintrc.jsonc');
	const oxfmtPath = join(rootDir, '.oxfmtrc.jsonc');
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
		oxlintPath,
		oxfmtPath,
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

	const rootPackage = readJson<{
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	}>(rootPackagePath);
	const preflightPackage = readJson<{
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	}>(preflightPackagePath);
	const preflightMcpPackage = readJson<{
		scripts: Record<string, string>;
		devDependencies: Record<string, string>;
	}>(preflightMcpPackagePath);
	const oxlint = readJson<{
		categories: Record<string, string>;
		options: Record<string, string | number | boolean>;
		plugins: string[];
		rules: Record<string, string>;
	}>(oxlintPath);
	const oxfmt = readJson<Record<string, unknown>>(oxfmtPath);
	const configuredCoverageThresholds = readCoverageThresholds(viteConfigPath);
	const configuredMcpCoverageThresholds = readCoverageThresholds(mcpViteConfigPath);
	const preflightGateWorkflow = readFileSync(preflightGateWorkflowPath, 'utf8');
	const dogfoodWorkflow = readFileSync(dogfoodWorkflowPath, 'utf8');

	pushCheck(
		checked,
		failures,
		'preflight scripts run oxfmt and oxlint with zero-warning lint',
		hasScriptCommand(preflightPackage.scripts, 'lint', ['oxfmt --check .', 'oxlint']) &&
			(preflightPackage.scripts.lint.includes('--max-warnings=0') ||
				oxlint.options.maxWarnings === 0 ||
				oxlint.options.denyWarnings === true)
	);
	pushCheck(
		checked,
		failures,
		'preflight verify runs standards, typecheck, lint, coverage, and build',
		hasScriptCommand(preflightPackage.scripts, 'verify', [
			'quality:standards',
			'sync:gate-remote:check',
			'check',
			'lint',
			'test:coverage',
			'build'
		])
	);
	pushCheck(
		checked,
		failures,
		'preflight-mcp verify runs typecheck, lint, coverage, and build',
		hasScriptCommand(preflightMcpPackage.scripts, 'verify', [
			'check',
			'lint',
			'test:coverage',
			'build'
		])
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
		'root deploylint CI verify runs audit, preflight, mcp, Playwright install, and e2e',
		hasScriptCommand(rootPackage.scripts, 'verify:deploylint:ci', [
			'npm run audit:security',
			'npm run verify -w preflight',
			'npm run verify -w preflight-mcp',
			'npm run test:e2e:install -w preflight',
			'npm run test:e2e -w preflight'
		])
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
			oxlint.options.reportUnusedDisableDirectives === 'error' &&
			['typescript', 'vitest', 'promise', 'unicorn', 'import'].every((plugin) =>
				oxlint.plugins.includes(plugin)
			) &&
			oxlint.rules['no-debugger'] === 'error' &&
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
		'preflight-mcp coverage thresholds meet enterprise minimums',
		Object.entries(ENTERPRISE_COVERAGE_MINIMUMS).every(
			([metric, minimum]) =>
				configuredMcpCoverageThresholds[metric as keyof CoverageThresholds] >= minimum
		)
	);
	pushCheck(
		checked,
		failures,
		'GitHub workflows enforce canonical deploylint CI and MCP dogfood gates',
		preflightGateWorkflow.includes('npm run verify:deploylint:ci') &&
			preflightGateWorkflow.includes('apps/preflight-mcp/**') &&
			dogfoodWorkflow.includes('npm run verify -w preflight-mcp')
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
