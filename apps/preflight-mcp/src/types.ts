export type {
  LaunchBrief,
  RepoInfo,
  ScanCheck,
  ScanCoverage,
  ScanReport,
  ScannedPage,
} from "@vibe/deploylint-shared";

export type OutputFormat = "markdown" | "json";

export interface ScanOptions {
  url: string;
  unlockSessionId?: string;
  previousScore?: number;
}
