#!/usr/bin/env node
/**
 * Vendored Deploylint deploy gate for the composite GitHub Action.
 * Keep synced from apps/preflight/scripts/gate-remote.mjs.
 */

const P0_IDS = new Set([
	'reachable',
	'fetch',
	'https',
	'secrets',
	'privacy',
	'noindex',
	'robots-block',
	'env-committed',
	'form-security',
	'dependency-vulns',
	'workflow-pull-request-target',
	'checkout-server-owned',
	'webhook-signature-missing',
	'payment-env-safety',
	'docker-env-copy',
	'exposed-env',
	'exposed-git',
	'exposed-backup'
]);

const apiBase = (
  process.env.DEPLOYLINT_API ??
  process.env.PREFLIGHT_API ??
  "https://deploylint.com"
).replace(/\/$/, "");
const targetUrl = process.argv[2]?.trim() || process.env.PREFLIGHT_URL?.trim();
const minScore = Number(process.env.PREFLIGHT_MIN_SCORE ?? "80");
const advisory =
  (process.env.PREFLIGHT_MODE ?? "gate").toLowerCase() === "advisory";

if (!targetUrl) {
  console.error("Usage: node gate-remote.mjs <url>");
  process.exit(2);
}

function evaluateGate(report) {
  const reasons = [];
  if (report.verdict === "no-go")
    reasons.push(`Verdict NO-GO: ${report.verdictMessage}`);
  if (report.score < minScore)
    reasons.push(`Score ${report.score} is below minimum ${minScore}`);
  for (const check of report.checks ?? []) {
    if (check.status === "fail" && P0_IDS.has(check.id)) {
      reasons.push(`P0 blocker: ${check.title} - ${check.message}`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}

async function main() {
  console.log(`Scanning ${targetUrl} via ${apiBase} ...`);
  const res = await fetch(`${apiBase}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: targetUrl }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      body && typeof body.message === "string"
        ? body.message
        : `HTTP ${res.status}`,
    );
  }
  const result = evaluateGate(body);
  console.log(
    `Deploylint ${advisory ? "advisory" : "gate"}: ${result.pass ? "PASS" : "FAIL"}`,
  );
  console.log(`URL: ${body.finalUrl}`);
  console.log(
    `Score: ${body.score} - Verdict: ${String(body.verdict).toUpperCase()}`,
  );
  for (const reason of result.reasons) console.log(`- ${reason}`);
  process.exit(result.pass || advisory ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
