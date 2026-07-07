import { stableStorageKey } from '$lib/server/storage-key';

import type { SecuritySnapshot } from './security-diff';

export type MonitorPlan = 'alpha-free' | 'paid';
export type MonitorCadence = 'daily' | 'weekly';
export type MonitorStatus = 'pending' | 'ok' | 'alert' | 'error';
export type MonitorEventType = 'new-issues' | 'worsened-issues' | 'resolved' | 'scan-error';

export interface MonitorNotifications {
	enabled: boolean;
	email?: string | null;
	webhookUrl?: string | null;
}

export interface MonitorTarget {
	id: string;
	ownerKey: string;
	url: string;
	normalizedUrl: string;
	createdAt: string;
	updatedAt: string;
	cadence: MonitorCadence;
	plan: MonitorPlan;
	notifications: MonitorNotifications;
	lastScanAt?: string;
	lastStatus?: MonitorStatus;
}

export interface UpsertMonitorTargetInput {
	ownerKey: string;
	url: string;
	now: string;
	cadence?: MonitorCadence;
	plan?: MonitorPlan;
	notifications?: Partial<MonitorNotifications>;
}

export interface MonitorEvent {
	id: string;
	targetId: string;
	createdAt: string;
	type: MonitorEventType;
	issueIds: string[];
	message?: string;
}

const MAX_TARGETS_PER_OWNER = 50;
const MAX_EVENTS_PER_TARGET = 20;

export function monitorTargetKey(id: string): string {
	return `monitor-target:${id}`;
}

function monitorIndexKey(ownerKey: string): string {
	return stableStorageKey('monitor-index', ownerKey);
}

function monitorSnapshotKey(targetId: string): string {
	return `monitor-snapshot:${targetId}`;
}

function monitorEventKey(targetId: string): string {
	return `monitor-event:${targetId}`;
}

function normalizeMonitorUrl(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
		if (url.username || url.password) return null;
		url.hash = '';
		url.protocol = url.protocol.toLowerCase();
		url.hostname = url.hostname.toLowerCase();
		return url.href;
	} catch {
		return null;
	}
}

function monitorTargetId(ownerKey: string, normalizedUrl: string): string {
	return stableStorageKey('monitor-target-id', `${ownerKey}\0${normalizedUrl}`).split(':')[1];
}

export async function upsertMonitorTarget(
	kv: KVNamespace,
	input: UpsertMonitorTargetInput
): Promise<MonitorTarget | null> {
	const normalizedUrl = normalizeMonitorUrl(input.url);
	if (!normalizedUrl) return null;

	const id = monitorTargetId(input.ownerKey, normalizedUrl);
	const existing = await loadMonitorTarget(kv, id);
	const target: MonitorTarget = {
		id,
		ownerKey: input.ownerKey,
		url: input.url,
		normalizedUrl,
		createdAt: existing?.createdAt ?? input.now,
		updatedAt: input.now,
		cadence: input.cadence ?? existing?.cadence ?? 'daily',
		plan: input.plan ?? existing?.plan ?? 'alpha-free',
		notifications: {
			enabled: input.notifications?.enabled ?? existing?.notifications.enabled ?? true,
			email: input.notifications?.email ?? existing?.notifications.email ?? null,
			webhookUrl: input.notifications?.webhookUrl ?? existing?.notifications.webhookUrl ?? null
		},
		lastScanAt: existing?.lastScanAt,
		lastStatus: existing?.lastStatus
	};

	try {
		await kv.put(monitorTargetKey(id), JSON.stringify(target));
		await addTargetToOwnerIndex(kv, input.ownerKey, id);
		return target;
	} catch {
		return null;
	}
}

async function loadMonitorTarget(kv: KVNamespace, targetId: string): Promise<MonitorTarget | null> {
	try {
		return await kv.get<MonitorTarget>(monitorTargetKey(targetId), 'json');
	} catch {
		return null;
	}
}

export async function listMonitorTargets(
	kv: KVNamespace,
	ownerKey: string
): Promise<MonitorTarget[]> {
	try {
		const ids = (await kv.get<string[]>(monitorIndexKey(ownerKey), 'json')) ?? [];
		const targets = await Promise.all(ids.map((id) => loadMonitorTarget(kv, id)));
		return targets.filter((target): target is MonitorTarget => target?.ownerKey === ownerKey);
	} catch {
		return [];
	}
}

export async function deleteMonitorTarget(
	kv: KVNamespace,
	ownerKey: string,
	targetId: string
): Promise<boolean> {
	try {
		const target = await loadMonitorTarget(kv, targetId);
		if (!target || target.ownerKey !== ownerKey) return false;

		await kv.delete(monitorTargetKey(targetId));
		const ids = (await kv.get<string[]>(monitorIndexKey(ownerKey), 'json')) ?? [];
		await kv.put(
			monitorIndexKey(ownerKey),
			JSON.stringify(ids.filter((id) => id !== targetId).slice(0, MAX_TARGETS_PER_OWNER))
		);
		return true;
	} catch {
		return false;
	}
}

export async function saveSecuritySnapshot(
	kv: KVNamespace,
	targetId: string,
	snapshot: SecuritySnapshot
): Promise<boolean> {
	try {
		await kv.put(monitorSnapshotKey(targetId), JSON.stringify(snapshot));
		return true;
	} catch {
		return false;
	}
}

export async function loadSecuritySnapshot(
	kv: KVNamespace,
	targetId: string
): Promise<SecuritySnapshot | null> {
	try {
		return await kv.get<SecuritySnapshot>(monitorSnapshotKey(targetId), 'json');
	} catch {
		return null;
	}
}

export async function recordMonitorEvent(
	kv: KVNamespace,
	targetId: string,
	event: MonitorEvent
): Promise<MonitorEvent[]> {
	try {
		const previous = (await kv.get<MonitorEvent[]>(monitorEventKey(targetId), 'json')) ?? [];
		const next = [event, ...previous].slice(0, MAX_EVENTS_PER_TARGET);
		await kv.put(monitorEventKey(targetId), JSON.stringify(next));
		return next;
	} catch {
		return [];
	}
}

async function addTargetToOwnerIndex(
	kv: KVNamespace,
	ownerKey: string,
	targetId: string
): Promise<void> {
	const key = monitorIndexKey(ownerKey);
	const existing = (await kv.get<string[]>(key, 'json')) ?? [];
	const next = [targetId, ...existing.filter((id) => id !== targetId)].slice(
		0,
		MAX_TARGETS_PER_OWNER
	);
	await kv.put(key, JSON.stringify(next));
}
