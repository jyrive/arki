#!/usr/bin/env node
/**
 * Standalone fetcher. Runs hourly from systemd on the VPS.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/cron-fetch.ts
 *
 * Requires: SQLITE_PATH, WILMA_*, GOOGLE_*.
 */
import { runRefresh } from '../src/lib/server/refresh';
import { hasDb } from '../src/lib/server/db';

if (!hasDb()) {
	console.error('SQLITE_PATH not set');
	process.exit(2);
}

const result = await runRefresh(process.env);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
