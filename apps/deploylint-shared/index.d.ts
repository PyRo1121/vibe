export declare const DEPLOYLINT_HOST = "deploylint.com";
export declare const DEPLOYLINT_WWW_HOST = "www.deploylint.com";
export declare const DEPLOYLINT_LEGACY_HOST = "lint.latham.cloud";
export declare const DEFAULT_DEPLOYLINT_API = "https://deploylint.com";

export type CheckPriority = "p0" | "p1" | "p2";
export type LaunchVerdict = "go" | "conditional" | "no-go";
export type ScanCoverage = "full" | "blocked";
export type CheckStatus = "pass" | "warn" | "fail";
export type CheckCategory =
  "seo" | "legal" | "security" | "a11y" | "mobile" | "launch" | "payments";

export interface SocialPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  imageUrl: string | null;
  twitterCard: string | null;
  issues: string[];
  ready: boolean;
  imageReachable?: boolean | null;
}

export interface ScanCheck {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  message: string;
  priority?: CheckPriority;
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
  masterPrompt?: string;
  samplePromptId?: string;
  reportId?: string;
  history?: Array<{ id: string; score: number; verdict: string; at: string }>;
  scanDiff?: { fixed: string[]; regressed: string[] } | null;
  aiCopyReview?: { bullets: string[]; headline: string; subhead: string };
  previousScore?: number;
  scoreDelta?: number;
  unlocked?: boolean;
  scanCoverage?: ScanCoverage;
  scanCoverageMessage?: string;
  licenseAudit?: LicenseAudit;
  pagesScanned?: ScannedPage[];
  repo?: RepoInfo;
  stack?: string[];
}

export interface ScannedPage {
  url: string;
  role: "home" | "privacy" | "terms" | "pricing" | "sitemap";
  status: number | null;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  description: string | null;
  stars: number | null;
  license: string | null;
  filesSampled: string[];
  depCount: number | null;
}

export type Sellability = "yes" | "conditions" | "risk" | "unknown";

export type LicenseCategory =
  | "permissive"
  | "weak-copyleft"
  | "strong-copyleft"
  | "noncommercial"
  | "commercial"
  | "service"
  | "unknown";

export interface DetectedLibrary {
  name: string;
  version: string | null;
  source: string;
  license: string;
  spdx: string | null;
  category: LicenseCategory;
  sellable: Sellability;
  note: string;
}

export interface LicenseAudit {
  libraries: DetectedLibrary[];
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
