<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	import DeepDive from './DeepDive.svelte';
	import LicenseAuditPanel from './LicenseAuditPanel.svelte';
	import PaymentReadinessPanel from './PaymentReadinessPanel.svelte';
	import SocialPreviewPanel from './SocialPreviewPanel.svelte';
	import WebVitalsPanel from './WebVitalsPanel.svelte';

	let { report }: { report: ScanReport } = $props();

	const SOCIAL_CHECK_IDS = new Set([
		'open-graph',
		'twitter-card',
		'og-image-live',
		'og-image-type'
	]);

	const socialIssues = $derived(
		report.checks.filter((c) => SOCIAL_CHECK_IDS.has(c.id) && c.status !== 'pass').length
	);
	const licenseFlagged = $derived(
		report.licenseAudit
			? report.licenseAudit.libraries.filter((l) => l.sellable !== 'yes').length
			: 0
	);
	const paymentReadiness = $derived(report.paymentReadiness ?? null);

	function paymentBadgeLabel(): string {
		if (!paymentReadiness) return 'not detected';
		if (paymentReadiness.fail > 0) {
			return `${paymentReadiness.fail} blocker${paymentReadiness.fail === 1 ? '' : 's'}`;
		}
		if (paymentReadiness.warn > 0) {
			return `${paymentReadiness.warn} warning${paymentReadiness.warn === 1 ? '' : 's'}`;
		}
		return 'ready';
	}
</script>

{#if report.scanCoverage !== 'blocked'}
	<section class="mb-10">
		<h2 class="mb-4 text-xl font-semibold text-white">Deep dives</h2>
		{#if report.socialPreview}
			<DeepDive
				title="Social preview"
				hint="How your link renders on X and Slack"
				badge={socialIssues > 0
					? { label: `${socialIssues} issue${socialIssues === 1 ? '' : 's'}`, tone: 'warn' }
					: { label: 'looks good', tone: 'ok' }}
				open={socialIssues > 0}
			>
				<SocialPreviewPanel {report} />
			</DeepDive>
		{/if}
		{#if report.licenseAudit}
			<DeepDive
				title="License & sell rights"
				hint="Can you charge money for this?"
				badge={licenseFlagged > 0
					? { label: `${licenseFlagged} flagged`, tone: 'warn' }
					: { label: 'clear', tone: 'ok' }}
				open={licenseFlagged > 0}
			>
				<LicenseAuditPanel {report} />
			</DeepDive>
		{/if}
		{#if paymentReadiness && paymentReadiness.status !== 'not-detected'}
			<DeepDive
				title="Payment readiness"
				hint="Checkout, webhooks, fulfillment, and customer access"
				badge={{
					label: paymentBadgeLabel(),
					tone: paymentReadiness.status === 'ready' ? 'ok' : 'warn'
				}}
				open={paymentReadiness.status !== 'ready'}
			>
				<PaymentReadinessPanel {paymentReadiness} />
			</DeepDive>
		{/if}
		{#if !report.repo}
			<DeepDive title="Core Web Vitals" hint="Google PageSpeed — measure on demand">
				<WebVitalsPanel {report} />
			</DeepDive>
		{/if}
	</section>
{/if}
