import type { ScanCheck } from '$lib/scan/types';
import { normalizeRepoFinding, type RepoFinding } from '$lib/scan/repo/findings';

export type RepoReadinessFinding = RepoFinding;

export interface PackageManifestEvidence {
	path: string;
	json: {
		scripts?: Record<string, string>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		optionalDependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
		engines?: { node?: string };
		packageManager?: string;
		devEngines?: {
			packageManager?:
				| string
				| {
						name?: string;
						version?: string;
						onFail?: string;
				  };
		};
	};
}

function finding(
	id: string,
	title: string,
	status: ScanCheck['status'],
	message: string,
	evidence?: RepoReadinessFinding['evidence'],
	category: ScanCheck['category'] = 'launch'
): RepoReadinessFinding {
	return normalizeRepoFinding({ id, category, title, status, message, evidence });
}

const CORE_SCRIPT_NAMES = ['lint', 'test', 'build'] as const;
const CHECK_SCRIPT_NAMES = ['check', 'typecheck'] as const;

function scriptValue(manifest: PackageManifestEvidence | undefined, name: string): string | null {
	const value = manifest?.json.scripts?.[name]?.trim();
	return value ? value : null;
}

function isPlaceholderScript(script: string): boolean {
	return /(^|\s)(true|exit\s+0)\s*$/i.test(script) || /echo\s+['"]?no tests/i.test(script);
}

function hasUsefulScript(manifest: PackageManifestEvidence | undefined, name: string): boolean {
	const script = scriptValue(manifest, name);
	return Boolean(script && !isPlaceholderScript(script));
}

function hasAnyUsefulScript(
	manifest: PackageManifestEvidence | undefined,
	names: readonly string[]
): boolean {
	return names.some((name) => hasUsefulScript(manifest, name));
}

function scriptFinding(
	id: string,
	title: string,
	scriptName: string,
	root: PackageManifestEvidence | undefined
): RepoReadinessFinding {
	const script = scriptValue(root, scriptName);
	if (!script) {
		return finding(id, title, 'warn', `No ${scriptName} script found in root package.json.`, {
			path: root?.path
		});
	}
	if (isPlaceholderScript(script)) {
		return finding(
			id,
			title,
			'warn',
			`The ${scriptName} script in package.json is a placeholder.`,
			{
				path: root?.path,
				snippet: script
			}
		);
	}
	return finding(id, title, 'pass', `Root package.json defines "${scriptName}": ${script}.`, {
		path: root?.path,
		snippet: script
	});
}

export function analyzePackageScripts(
	manifests: PackageManifestEvidence[]
): RepoReadinessFinding[] {
	const root = manifests.find((manifest) => manifest.path === 'package.json') ?? manifests[0];
	const rootMissing = CORE_SCRIPT_NAMES.filter((name) => !hasUsefulScript(root, name));
	const placeholder = CORE_SCRIPT_NAMES.filter((name) => {
		const script = scriptValue(root, name);
		return Boolean(script && isPlaceholderScript(script));
	});
	const nestedHasCore = manifests
		.filter((manifest) => manifest.path !== root?.path)
		.some((manifest) => CORE_SCRIPT_NAMES.every((name) => hasUsefulScript(manifest, name)));

	const summary =
		rootMissing.length === 0
			? 'Root package.json exposes useful lint, test, and build scripts.'
			: nestedHasCore
				? 'nested apps have scripts, but the root package.json does not expose lint, test, and build for pre-push checks.'
				: placeholder.length > 0
					? `Root package.json has placeholder ${placeholder.join(', ')} scripts.`
					: `Root package.json is missing ${rootMissing.join(', ')} script${rootMissing.length === 1 ? '' : 's'}.`;

	return [
		finding(
			'package-scripts',
			'Package scripts',
			rootMissing.length === 0 ? 'pass' : 'warn',
			summary,
			root ? { path: root.path } : undefined
		),
		scriptFinding('lint-script', 'Lint script', 'lint', root),
		scriptFinding('build-script', 'Build script', 'build', root),
		hasAnyUsefulScript(root, CHECK_SCRIPT_NAMES)
			? finding(
					'typecheck-script',
					'Typecheck script',
					'pass',
					'Root package.json exposes a check or typecheck script.',
					{ path: root?.path }
				)
			: finding(
					'typecheck-script',
					'Typecheck script',
					'warn',
					'No check or typecheck script found in root package.json.',
					{ path: root?.path }
				)
	];
}

export interface RepoFileEvidence {
	path: string;
	text: string | null;
}

function rootManifest(manifests: PackageManifestEvidence[]): PackageManifestEvidence | undefined {
	return manifests.find((manifest) => manifest.path === 'package.json') ?? manifests[0];
}

function dependencies(manifest: PackageManifestEvidence | undefined): Record<string, string> {
	return Object.assign(
		{},
		manifest?.json.dependencies,
		manifest?.json.devDependencies,
		manifest?.json.optionalDependencies,
		manifest?.json.peerDependencies
	);
}

function hasDependency(manifest: PackageManifestEvidence | undefined, names: string[]): boolean {
	const all = dependencies(manifest);
	return names.some((name) => all[name] != null);
}

function hasFile(files: RepoFileEvidence[], patterns: RegExp[]): RepoFileEvidence | undefined {
	return files.find((file) => patterns.some((pattern) => pattern.test(file.path)));
}

function scriptIncludes(
	manifest: PackageManifestEvidence | undefined,
	scriptName: string,
	patterns: RegExp[]
): boolean {
	const script = scriptValue(manifest, scriptName);
	return Boolean(script && patterns.some((pattern) => pattern.test(script)));
}

export function analyzeLintSetup(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	const root = rootManifest(manifests);
	const eslintConfig = hasFile(files, [
		/(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/,
		/(^|\/)\.eslintrc(\.(json|js|cjs|yml|yaml))?$/
	]);
	const biomeConfig = hasFile(files, [/(^|\/)biome\.jsonc?$/]);
	const prettierConfig = hasFile(files, [
		/(^|\/)\.prettierrc(\.(json|js|cjs|mjs|yml|yaml))?$/,
		/(^|\/)prettier\.config\.(js|cjs|mjs|ts)$/
	]);

	const lintConfigured =
		Boolean(eslintConfig || biomeConfig) || hasDependency(root, ['eslint', '@biomejs/biome']);
	const lintRuns =
		scriptIncludes(root, 'lint', [/\beslint\b/, /\bbiome\s+check\b/, /\bbiome\s+lint\b/]) ||
		scriptIncludes(root, 'check', [/\beslint\b/, /\bbiome\s+check\b/]);
	const formatRuns =
		scriptIncludes(root, 'format', [/\bprettier\b/, /\bbiome\s+format\b/, /\bbiome\s+check\b/]) ||
		scriptIncludes(root, 'lint', [/\bprettier\s+--check\b/]);

	return [
		finding(
			'lint-script',
			'Lint script',
			lintConfigured && lintRuns ? 'pass' : 'warn',
			lintConfigured && lintRuns
				? 'Lint tooling is configured and invoked by package scripts.'
				: lintConfigured
					? 'Lint config exists, but root package.json does not run it from lint or check.'
					: 'No ESLint or Biome configuration found for JavaScript/TypeScript linting.',
			{ path: eslintConfig?.path ?? biomeConfig?.path ?? root?.path }
		),
		finding(
			'format-script',
			'Format script',
			formatRuns ? 'pass' : 'warn',
			formatRuns
				? 'Formatting is available from package scripts.'
				: prettierConfig || biomeConfig
					? `${prettierConfig ? 'Prettier' : 'Biome'} config exists, but root package.json has no format script.`
					: 'No Prettier or Biome format script found.',
			{ path: prettierConfig?.path ?? biomeConfig?.path ?? root?.path }
		)
	];
}

export function analyzeTypescriptSetup(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	const root = rootManifest(manifests);
	const tsconfig = hasFile(files, [/(^|\/)tsconfig\.json$/]);
	const hasTypescript = Boolean(tsconfig) || hasDependency(root, ['typescript']);
	const hasSvelteKit = hasDependency(root, ['@sveltejs/kit']);
	const hasSvelteCheck = hasDependency(root, ['svelte-check']);
	const hasTypecheckScript = hasAnyUsefulScript(root, CHECK_SCRIPT_NAMES);
	const runsSvelteCheck =
		scriptIncludes(root, 'check', [/\bsvelte-check\b/]) ||
		scriptIncludes(root, 'typecheck', [/\bsvelte-check\b/]);

	if (!hasTypescript && !hasSvelteKit) return [];

	return [
		finding(
			'typecheck-script',
			'Typecheck script',
			hasTypecheckScript ? 'pass' : 'warn',
			hasTypecheckScript
				? 'Root package.json exposes a check or typecheck script.'
				: 'TypeScript is present, but root package.json has no check or typecheck script.',
			{ path: root?.path }
		),
		...(hasSvelteKit
			? [
					finding(
						'svelte-check',
						'Svelte check',
						hasSvelteCheck && runsSvelteCheck ? 'pass' : 'warn',
						hasSvelteCheck && runsSvelteCheck
							? 'SvelteKit project runs svelte-check from package scripts.'
							: hasSvelteCheck
								? 'svelte-check is installed, but no check/typecheck script invokes it.'
								: 'SvelteKit project is missing svelte-check for template and route typing.',
						{ path: root?.path }
					)
				]
			: [])
	];
}

const LOCKFILE_MANAGER: Record<string, string> = {
	'package-lock.json': 'npm',
	'npm-shrinkwrap.json': 'npm',
	'pnpm-lock.yaml': 'pnpm',
	'yarn.lock': 'yarn',
	'bun.lock': 'bun',
	'bun.lockb': 'bun'
};

function managerFromPackageJson(root: PackageManifestEvidence | undefined): string | null {
	const pinned = root?.json.packageManager?.split('@')[0]?.trim();
	if (pinned) return pinned;
	const devManager = root?.json.devEngines?.packageManager;
	if (typeof devManager === 'string') return devManager.split('@')[0]?.trim() || null;
	return devManager?.name?.trim() || null;
}

function lockfileManagers(files: RepoFileEvidence[]): string[] {
	return [
		...new Set(
			files
				.map((file) => file.path.split('/').pop() ?? file.path)
				.map((name) => LOCKFILE_MANAGER[name])
				.filter((name): name is string => Boolean(name))
		)
	];
}

export function analyzePackageManager(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	const root = rootManifest(manifests);
	const pinnedManager = managerFromPackageJson(root);
	const managers = lockfileManagers(files);
	const mismatched =
		Boolean(pinnedManager) &&
		managers.length > 0 &&
		(managers.length > 1 || !managers.includes(pinnedManager as string));

	return [
		finding(
			'package-manager-pinned',
			'Package manager pinned',
			pinnedManager && !mismatched ? 'pass' : 'warn',
			pinnedManager
				? mismatched
					? `Pinned package manager ${pinnedManager} does not match committed lockfile (${managers.join(', ')}).`
					: `Root package.json pins package manager ${root?.json.packageManager ?? pinnedManager}.`
				: 'Root package.json does not pin a package manager with packageManager or devEngines.packageManager.',
			{ path: root?.path }
		),
		finding(
			'mixed-lockfiles',
			'Mixed lockfiles',
			managers.length <= 1 ? 'pass' : 'warn',
			managers.length <= 1
				? managers.length === 1
					? `One package manager lockfile family detected: ${managers[0]}.`
					: 'No root package manager lockfile detected.'
				: `Multiple package manager lockfiles detected: ${managers.join(', ')}.`,
			{
				path: files.find((file) => LOCKFILE_MANAGER[file.path.split('/').pop() ?? file.path])?.path
			}
		)
	];
}

function workflowFiles(files: RepoFileEvidence[]): RepoFileEvidence[] {
	return files.filter((file) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file.path));
}

function allWorkflowText(files: RepoFileEvidence[]): string {
	return workflowFiles(files)
		.map((file) => file.text ?? '')
		.join('\n');
}

function stripYamlComment(line: string): string {
	let quote: '"' | "'" | null = null;
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		const previous = line[index - 1];
		if ((char === '"' || char === "'") && previous !== '\\') {
			quote = quote === char ? null : (quote ?? char);
			continue;
		}
		if (char === '#' && quote == null && (index === 0 || /\s/.test(previous ?? ''))) {
			return line.slice(0, index);
		}
	}
	return line;
}

function unquoteYamlScalar(value: string): string {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function meaningfulWorkflowLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => stripYamlComment(line).trimEnd())
		.filter((line) => line.trim().length > 0);
}

function workflowRunCommands(text: string): string[] {
	const lines = text.split(/\r?\n/);
	const runs: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const raw = lines[index] ?? '';
		const cleaned = stripYamlComment(raw);
		const match =
			cleaned.match(/^(\s*)-\s*run\s*:\s*(.*)$/) ?? cleaned.match(/^(\s*)run\s*:\s*(.*)$/);
		if (!match) continue;

		const baseIndent = match[1]?.length ?? 0;
		const rawValue = match[2]?.trim() ?? '';
		if (/^[|>][+-]?$/.test(rawValue)) {
			const block: string[] = [];
			index += 1;
			for (; index < lines.length; index += 1) {
				const blockRaw = lines[index] ?? '';
				if (!blockRaw.trim()) {
					block.push('');
					continue;
				}

				const blockIndent = blockRaw.match(/^\s*/)?.[0].length ?? 0;
				if (blockIndent <= baseIndent) {
					index -= 1;
					break;
				}

				const blockLine = stripYamlComment(blockRaw).trim();
				if (blockLine) block.push(blockLine);
			}
			if (block.some((line) => line.trim())) runs.push(block.join('\n'));
			continue;
		}

		const value = unquoteYamlScalar(rawValue);
		if (value) runs.push(value);
	}

	return runs;
}

function workflowUsesRefs(text: string): Array<{ action: string; ref: string }> {
	const refs: Array<{ action: string; ref: string }> = [];
	for (const line of meaningfulWorkflowLines(text)) {
		const match = line.match(/^\s*(?:-\s*)?uses\s*:\s*(.+)$/);
		if (!match) continue;

		const value = unquoteYamlScalar(match[1] ?? '');
		const atIndex = value.lastIndexOf('@');
		if (atIndex <= 0 || atIndex === value.length - 1) continue;

		refs.push({
			action: value.slice(0, atIndex),
			ref: value.slice(atIndex + 1)
		});
	}
	return refs;
}

function hasWorkflowEvent(text: string, eventName: string): boolean {
	return meaningfulWorkflowLines(text).some((line) =>
		new RegExp(`(^|[\\s\\[,])${eventName}(:|\\b)`).test(line)
	);
}

function hasWorkflowPermissions(text: string): boolean {
	return meaningfulWorkflowLines(text).some((line) => /^\s*permissions\s*:/.test(line));
}

function hasWriteAllPermissions(text: string): boolean {
	return meaningfulWorkflowLines(text).some((line) =>
		/^\s*permissions\s*:\s*write-all\b/i.test(line)
	);
}

function qualityGateSummary(text: string): string[] {
	const gates: Array<[string, RegExp]> = [
		['lint', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b|\bbiome\s+check\b|\beslint\b/i],
		['typecheck', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(check|typecheck)\b|\bsvelte-check\b|\btsc\b/i],
		['test', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\bvitest\b|\bplaywright\b/i],
		['build', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\bvite\s+build\b/i]
	];
	return gates.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function hasRiskyPullRequestTarget(text: string): boolean {
	return (
		hasWorkflowEvent(text, 'pull_request_target') &&
		workflowRunCommands(text).some((command) =>
			/\$\{\{\s*github\.event\.(pull_request|issue|comment)\./.test(command)
		)
	);
}

function hasUnsafePullRequestTargetCheckout(text: string): boolean {
	return (
		hasWorkflowEvent(text, 'pull_request_target') &&
		/\buses\s*:\s*actions\/checkout@/i.test(text) &&
		(/allow-unsafe-pr-checkout\s*:\s*true/i.test(text) ||
			/ref\s*:\s*(refs\/pull\/|.*github\.event\.pull_request\.head\.(sha|ref))/i.test(text) ||
			/repository\s*:\s*.*github\.event\.pull_request\.head\.repo\.full_name/i.test(text))
	);
}

function hasFloatingThirdPartyAction(text: string): boolean {
	for (const { action, ref } of workflowUsesRefs(text)) {
		if (action.startsWith('actions/')) continue;
		if (/^(main|master|latest|HEAD)$/i.test(ref)) return true;
	}
	return false;
}

function hasDependencyReviewAction(text: string): boolean {
	return workflowUsesRefs(text).some(({ action }) => action === 'actions/dependency-review-action');
}

function dependencyUpdateConfig(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return hasFile(files, [
		/^\.github\/dependabot\.ya?ml$/,
		/(^|\/)renovate\.json5?$/,
		/(^|\/)\.renovaterc(\.json)?$/
	]);
}

export function analyzeCiWorkflows(files: RepoFileEvidence[]): RepoReadinessFinding[] {
	const workflows = workflowFiles(files);
	if (workflows.length === 0) {
		return [
			finding(
				'ci-runs-quality-gates',
				'CI quality gates',
				'warn',
				'No GitHub Actions workflow found to run lint, typecheck, tests, and build.'
			)
		];
	}

	const text = allWorkflowText(files);
	const runText = workflows.flatMap((file) => workflowRunCommands(file.text ?? '')).join('\n');
	const gates = qualityGateSummary(runText);
	const missing = ['lint', 'typecheck', 'test', 'build'].filter((gate) => !gates.includes(gate));
	const writeAll = workflows.some((file) => hasWriteAllPermissions(file.text ?? ''));
	const hasPermissions = workflows.some((file) => hasWorkflowPermissions(file.text ?? ''));
	const riskyTarget = hasRiskyPullRequestTarget(text) || hasUnsafePullRequestTargetCheckout(text);
	const floatingAction = hasFloatingThirdPartyAction(text);
	const dependencyReview = hasDependencyReviewAction(text);
	const updateConfig = dependencyUpdateConfig(files);
	const evidencePath = workflows[0]?.path;

	return [
		finding(
			'ci-runs-quality-gates',
			'CI quality gates',
			missing.length === 0 ? 'pass' : 'warn',
			missing.length === 0
				? 'GitHub Actions workflow runs lint, typecheck/check, tests, and build.'
				: `GitHub Actions workflow is missing quality gates: ${missing.join(', ')}.`,
			{ path: evidencePath }
		),
		finding(
			'workflow-permissions',
			'Workflow permissions',
			writeAll || !hasPermissions ? 'warn' : 'pass',
			writeAll
				? 'GitHub Actions workflow grants permissions: write-all.'
				: hasPermissions
					? 'GitHub Actions workflow declares explicit token permissions.'
					: 'GitHub Actions workflow does not declare permissions; GitHub defaults may be broader than needed.',
			{ path: evidencePath },
			'security'
		),
		finding(
			'workflow-pull-request-target',
			'pull_request_target safety',
			riskyTarget ? 'fail' : hasWorkflowEvent(text, 'pull_request_target') ? 'warn' : 'pass',
			riskyTarget
				? 'pull_request_target workflow runs shell code with untrusted pull request context.'
				: hasWorkflowEvent(text, 'pull_request_target')
					? 'pull_request_target workflow found; review token and checkout behavior carefully.'
					: 'No pull_request_target workflow risk detected.',
			{ path: evidencePath },
			'security'
		),
		finding(
			'workflow-action-pinning',
			'Workflow action pinning',
			floatingAction ? 'warn' : 'pass',
			floatingAction
				? 'Third-party GitHub Action uses a floating ref such as main, master, or latest.'
				: 'No floating third-party GitHub Action refs detected.',
			{ path: evidencePath },
			'security'
		),
		finding(
			'dependency-review-action',
			'Dependency review action',
			dependencyReview ? 'pass' : 'warn',
			dependencyReview
				? 'GitHub Actions runs dependency review on pull requests.'
				: 'No GitHub dependency review action found; vulnerable dependency changes may reach review unnoticed.',
			{ path: evidencePath },
			'security'
		),
		finding(
			'dependabot-config',
			'Dependency update automation',
			updateConfig ? 'pass' : 'warn',
			updateConfig
				? `Dependency update automation configured at ${updateConfig.path}.`
				: 'No Dependabot or Renovate configuration found for dependency update automation.',
			{ path: updateConfig?.path ?? evidencePath },
			'security'
		)
	];
}

const PAYMENT_PROVIDER_DEPENDENCIES = ['stripe', '@stripe/stripe-js', '@stripe/react-stripe-js'];

function manifestsHaveDependency(
	manifests: PackageManifestEvidence[],
	names: string[]
): boolean {
	return manifests.some((manifest) => hasDependency(manifest, names));
}

function combinedFileText(files: RepoFileEvidence[]): string {
	return files
		.map((file) => file.text ?? '')
		.filter(Boolean)
		.join('\n');
}

function paymentProviderDetected(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): boolean {
	if (manifestsHaveDependency(manifests, PAYMENT_PROVIDER_DEPENDENCIES)) return true;
	const text = combinedFileText(files);
	return /\b(stripe\.checkout|checkout\.sessions\.create|PaymentIntent|price_[A-Za-z0-9]+|Stripe\(|stripe\.webhooks)\b/i.test(
		text
	);
}

function webhookSignal(files: RepoFileEvidence[]): RepoFileEvidence | undefined {
	return files.find((file) => {
		const text = file.text ?? '';
		return (
			/webhook/i.test(file.path) ||
			/\b(checkout\.session\.completed|customer\.subscription|invoice\.payment_failed|stripe-signature|webhook)\b/i.test(
				text
			)
		);
	});
}

function hasWebhookSignatureVerification(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return /stripe\.webhooks\.constructEvent(?:Async)?\b|constructEventAsync\b|STRIPE_WEBHOOK_SECRET|webhookSecret/i.test(
		text
	);
}

function hasBillingPortalSignal(files: RepoFileEvidence[]): boolean {
	const text = combinedFileText(files);
	return (
		/\b(billingPortal\.sessions\.create|billing_portal|customer portal)\b/i.test(text) ||
		files.some((file) => /(^|\/)(account\/billing|settings\/billing|billing)(\/|$)/i.test(file.path))
	);
}

export function analyzeBillingReadiness(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	if (!paymentProviderDetected(manifests, files)) return [];

	const webhook = webhookSignal(files);
	const verifiesWebhook = hasWebhookSignatureVerification(files);
	const hasPortal = hasBillingPortalSignal(files);

	return [
		finding(
			'webhook-signature-missing',
			'Webhook signature verification',
			webhook ? (verifiesWebhook ? 'pass' : 'fail') : 'warn',
			webhook
				? verifiesWebhook
					? 'Stripe-like webhook handling verifies incoming event signatures.'
					: 'Stripe-like webhook handling was found without signature verification; forged events could mark subscriptions paid or canceled.'
				: 'Payment provider code was found, but no Stripe-like webhook handler was detected for subscription lifecycle events.',
			{ path: webhook?.path },
			'payments'
		),
		finding(
			'billing-portal',
			'Customer billing portal',
			hasPortal ? 'pass' : 'warn',
			hasPortal
				? 'Customer billing management or portal handling is present.'
				: 'Stripe-like subscription code was found, but no customer billing portal or billing-management route was detected.',
			{ path: files.find((file) => /billing/i.test(file.path))?.path },
			'payments'
		)
	];
}

const DEPLOY_CONFIG_PATTERNS = [
	/(^|\/)wrangler\.(jsonc?|toml)$/,
	/(^|\/)vercel\.json$/,
	/(^|\/)netlify\.toml$/,
	/(^|\/)Dockerfile$/,
	/(^|\/)docker-compose\.ya?ml$/
];

function monthsBetween(a: Date, b: Date): number {
	return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

function wranglerCompatibilityDate(text: string | null): Date | null {
	const match = text?.match(/compatibility_date["']?\s*[:=]\s*["'](\d{4}-\d{2}-\d{2})["']/);
	if (!match) return null;
	const date = new Date(`${match[1]}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function analyzeDeployConfig(
	_manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[],
	now = new Date()
): RepoReadinessFinding[] {
	const deployConfig = hasFile(files, DEPLOY_CONFIG_PATTERNS);
	const wrangler = hasFile(files, [/(^|\/)wrangler\.(jsonc?|toml)$/]);
	const docker = hasFile(files, [/(^|\/)Dockerfile$/]);
	const compatDate = wranglerCompatibilityDate(wrangler?.text ?? null);
	const staleCompat = compatDate ? monthsBetween(compatDate, now) > 6 : false;
	const dockerCopiesEnv = Boolean(docker?.text && /\b(COPY|ADD)\s+\.env(\s|$)/i.test(docker.text));

	return [
		finding(
			'deploy-config',
			'Deploy config',
			deployConfig ? 'pass' : 'warn',
			deployConfig
				? `Deploy/runtime config found at ${deployConfig.path}.`
				: 'No common deploy config found (Wrangler, Vercel, Netlify, Docker). If deploy is fully dashboard-managed, this may be fine.',
			deployConfig ? { path: deployConfig.path } : undefined
		),
		...(wrangler
			? [
					finding(
						'wrangler-compat-date',
						'Wrangler compatibility date',
						staleCompat ? 'warn' : 'pass',
						compatDate
							? staleCompat
								? `Wrangler compatibility_date is ${compatDate.toISOString().slice(0, 10)}, more than six months behind. Review Cloudflare runtime changes and update deliberately.`
								: `Wrangler compatibility_date is current enough: ${compatDate.toISOString().slice(0, 10)}.`
							: 'Wrangler config exists but no compatibility_date was detected.',
						{ path: wrangler.path }
					)
				]
			: []),
		...(docker
			? [
					finding(
						'docker-env-copy',
						'Docker dotenv copy',
						dockerCopiesEnv ? 'fail' : 'pass',
						dockerCopiesEnv
							? 'Dockerfile copies .env into the image. Use runtime secrets instead and add .env to .dockerignore.'
							: 'Dockerfile does not directly copy .env into the image.',
						{ path: docker.path },
						'security'
					)
				]
			: [])
	];
}
