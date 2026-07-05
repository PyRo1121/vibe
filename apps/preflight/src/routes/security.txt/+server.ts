import type { RequestHandler } from './$types';
import { securityTxtResponse } from '$lib/server/security-txt';

export const GET: RequestHandler = async () => securityTxtResponse();
