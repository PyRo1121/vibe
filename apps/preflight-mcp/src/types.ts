export interface ScanCheck {
	id: string;
	title: string;
	status: string;
	message: string;
	priority?: string;
	fixPrompt?: string;
}

export interface LaunchBrief {
	headline?: string;
	embarrassmentRisks?: string[];
}

export interface ScannedPage {
	url: string;
	role: string;
	status: number | null;
}

export interface ScanReport {
	url: string;
	finalUrl: string;
	score: number;
	verdict: string;
	verdictMessage: string;
	checks: ScanCheck[];
	summary: { pass: number; warn: number; fail: number };
	launchBrief?: LaunchBrief;
	reportId?: string;
	unlocked?: boolean;
	masterPrompt?: string;
	samplePromptId?: string;
	pagesScanned?: ScannedPage[];
	scanCoverage?: string;
	repo?: { owner: string; repo: string; branch: string };
	previousScore?: number;
	scoreDelta?: number;
}

export type OutputFormat = 'markdown' | 'json';

export interface ScanOptions {
	url: string;
	unlockSessionId?: string;
	previousScore?: number;
}
