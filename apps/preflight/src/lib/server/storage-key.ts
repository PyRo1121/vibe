import { createHash } from 'node:crypto';

export function stableStorageKey(prefix: string, value: string): string {
	return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
}
