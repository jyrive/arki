import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { hasDb } from '$lib/server/db';
import { runRefresh } from '$lib/server/refresh';

const env = process.env;

/**
 * HTTP entrypoint kept for manual triggering / debugging. The production
 * scheduled refresh runs from GitHub Actions (see `.github/workflows/cron-refresh.yml`)
 * because Wilma's Cloudflare WAF challenges Vercel egress IPs.
 */
async function handle(request: Request) {
	const secret = env.CRON_SECRET;
	if (!secret) throw error(500, 'CRON_SECRET not configured');
	const auth = request.headers.get('authorization') ?? '';
	if (auth !== `Bearer ${secret}`) throw error(401, 'unauthorized');
	if (!hasDb()) throw error(500, 'DATABASE_URL not configured');

	const result = await runRefresh(env);
	return json(result, { status: result.ok ? 200 : 207 });
}

export const GET: RequestHandler = async ({ request }) => {
	try {
		return await handle(request);
	} catch (err) {
		if (err instanceof Response) throw err;
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[cron] fatal:', msg, err instanceof Error ? err.stack : '');
		return json({ ok: false, error: msg }, { status: 500 });
	}
};
export const POST: RequestHandler = async ({ request }) => {
	try {
		return await handle(request);
	} catch (err) {
		if (err instanceof Response) throw err;
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[cron] fatal:', msg, err instanceof Error ? err.stack : '');
		return json({ ok: false, error: msg }, { status: 500 });
	}
};
