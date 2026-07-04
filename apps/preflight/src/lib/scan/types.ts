import type { CheckPriority, LaunchVerdict } from '$lib/scan/verdict';
import type { SocialPreview } from '$lib/scan/social';

/** `full` = homepage returned 2xx/3xx; `blocked` = 4xx/5xx or fetch failure, content checks skipped. */
export type ScanCoverage = 'full' | 'blocked';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type CheckCategory =
	'seo' | 'legal' | 'security' | 'a11y' | 'mobile' | 'launch' | 'payments';

export interface ScanCheck {
	id: string;
	category: CheckCategory;
	title: string;
	status: CheckStatus;
	message: string;
	priority?: CheckPriority;
	/** Shown on paid tier — included in API for future unlock */
	fixPrompt: string;
}

export interface ScanReport {
	url: string;
	finalUrl: string;
	scannedAt: string;
	score: number;
	verdict: LaunchVerdict;
	verdictMessage: string;
	checks: ScanCheck[];
	summary: { pass: number; warn: number; fail: number };
	socialPreview?: SocialPreview;
	launchBrief?: LaunchBrief;
	/** Master repair prompt — paid tier only */
	masterPrompt?: string;
	/** Id of the one sample prompt shown on free tier */
	samplePromptId?: string;
	/** Permalink id when the report was stored for sharing (/r/[id]). */
	reportId?: string;
	/** Prior scans of the same URL (oldest first), for trend display. */
	history?: Array<{ id: string; score: number; verdict: string; at: string }>;
	/** Check-level delta vs the previous scan of this URL (check titles). */
	scanDiff?: { fixed: string[]; regressed: string[] } | null;
	/** LLM landing-copy critique — only generated for unlocked scans. */
	aiCopyReview?: { bullets: string[]; headline: string; subhead: string };
	previousScore?: number;
	scoreDelta?: number;
	/** True when fix prompts are included in the response. */
	unlocked?: boolean;
	/** `blocked` when homepage HTTP status was 4xx/5xx — content checks skipped. */
	scanCoverage?: ScanCoverage;
	scanCoverageMessage?: string;
	/** Detected third-party libraries and whether their licenses allow selling the product. */
	licenseAudit?: LicenseAudit;
	/** Pages read during this scan (homepage first). */
	pagesScanned?: ScannedPage[];
	/** Set when the target was a GitHub repository. */
	repo?: RepoInfo;
	/** Detected frameworks / builders / hosts, most specific first. */
	stack?: string[];
}

export interface ScannedPage {
	url: string;
	role: 'home' | 'privacy' | 'terms' | 'pricing';
	/** HTTP status, or null when the fetch failed. */
	status: number | null;
}

/** Present when the scan target was a GitHub repository instead of a live site. */
export interface RepoInfo {
	owner: string;
	repo: string;
	branch: string;
	description: string | null;
	stars: number | null;
	/** SPDX id from GitHub, or null when the repo has no license file. */
	license: string | null;
	/** Repo files fetched and inspected during the scan. */
	filesSampled: string[];
	/** Production dependencies found in package.json (null = no package.json). */
	depCount: number | null;
}

/** Can code under this license ship inside a product the builder charges money for? */
export type Sellability = 'yes' | 'conditions' | 'risk' | 'unknown';

export type LicenseCategory =
	| 'permissive'
	| 'weak-copyleft'
	| 'strong-copyleft'
	| 'noncommercial'
	| 'commercial'
	| 'service'
	| 'unknown';

export interface DetectedLibrary {
	name: string;
	version: string | null;
	/** Where we saw it — CDN host or script filename. */
	source: string;
	license: string;
	spdx: string | null;
	category: LicenseCategory;
	sellable: Sellability;
	note: string;
}

export interface LicenseAudit {
	libraries: DetectedLibrary[];
	/** Worst-case sellability across all detected libraries. */
	sellable: Sellability;
	summary: string;
}

export interface ScanRequest {
	url: string;
	unlockSessionId?: string;
	previousScore?: number;
}

export interface CategoryScore {
	category: CheckCategory;
	label: string;
	score: number;
	pass: number;
	warn: number;
	fail: number;
}

export interface LaunchBrief {
	headline: string;
	embarrassmentRisks: string[];
	shareReady: boolean;
	categoryScores: CategoryScore[];
}
