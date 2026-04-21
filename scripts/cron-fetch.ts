#!/usr/bin/env node
/**
 * Standalone fetcher. Runs from GitHub Actions (so Wilma sees a GH/Azure IP
 * rather than Vercel's, which Cloudflare challenges).
 *
 * Usage:
 *   tsx scripts/cron-fetch.ts
 *
 * Reads env from process.env (populated by GitHub Actions or `--env-file=.env`).
 * Requires: DATABASE_URL, WILMA_*, GOOGLE_*, CRON_SECRET (unused here).
 */
import { runRefresh } from '../src/lib/server/refresh';
import { hasDb } from '../src/lib/server/db';

if (!hasDb()) {
	console.error('DATABASE_URL not set');
	process.exit(2);
}

const result = await runRefresh(process.env);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
