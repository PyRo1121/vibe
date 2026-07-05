import { securityTxtResponse } from '$lib/server/security-txt';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => securityTxtResponse();
