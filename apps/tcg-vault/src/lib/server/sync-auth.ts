import { error } from '@sveltejs/kit';

/** Require Bearer token when SYNC_SECRET is set, or always in production. */
export function requireSyncAuth(
	request: Request,
	secret: string | undefined,
	isProduction: boolean
) {
	if (secret) {
		const auth = request.headers.get('authorization');
		if (auth !== `Bearer ${secret}`) error(401, 'Unauthorized');
		return;
	}

	if (isProduction) {
		error(503, 'SYNC_SECRET is not configured');
	}
}
