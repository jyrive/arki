import { neon, neonConfig } from '@neondatabase/serverless';

const env = process.env;

// Use secure fetch in all environments.
neonConfig.fetchConnectionCache = true;

/**
 * Returns true when a Postgres database is configured. Pages and cron both
 * probe this; when false, the app falls back to live-fetch every request.
 */
export function hasDb(): boolean {
	return Boolean(env.DATABASE_URL);
}

let cached: ReturnType<typeof neon> | null = null;

/**
 * Tagged-template Neon HTTP client. Throws if `DATABASE_URL` isn't set — call
 * `hasDb()` first.
 *
 * Usage:
 *   const rows = await sql`SELECT 1 AS v`;
 */
export function getSql() {
	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL not configured');
	}
	if (!cached) cached = neon(env.DATABASE_URL);
	return cached;
}
