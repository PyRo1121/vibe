import { DEFAULT_DEPLOYLINT_API } from "@vibe/deploylint-shared";
import type { ScanOptions, ScanReport } from "./types.js";

export function apiBase(): string {
  return (
    process.env.DEPLOYLINT_API ??
    process.env.PREFLIGHT_API ??
    DEFAULT_DEPLOYLINT_API
  ).replace(/\/$/, "");
}

export function reportUrl(report: ScanReport): string | null {
  if (!report.reportId) return null;
  return `${apiBase()}/r/${report.reportId}`;
}

export async function fetchScan(opts: ScanOptions): Promise<ScanReport> {
  const body: Record<string, unknown> = { url: opts.url.trim() };
  if (opts.unlockSessionId) body.unlockSessionId = opts.unlockSessionId;
  if (opts.previousScore != null) body.previousScore = opts.previousScore;

  const res = await fetch(`${apiBase()}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    ScanReport | { message?: string } | null;
  if (!res.ok) {
    const message =
      json && "message" in json ? json.message : `HTTP ${res.status}`;
    throw new Error(message ?? `Scan failed (${res.status})`);
  }

  return json as ScanReport;
}
