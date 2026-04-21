import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getSql } from './db';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(HERE, 'schema.sql');

let migrated = false;

/**
 * Apply the schema. Idempotent — safe to call before every cron run. Uses
 * in-process memoization so repeated calls inside a single warm serverless
 * instance skip the round-trip.
 */
export async function migrate(): Promise<void> {
	if (migrated) return;
	const sql = getSql();
	const ddl = await readFile(SCHEMA_PATH, 'utf8');
	// Neon's HTTP driver can't run multiple statements in one template call,
	// so split on blank lines / semicolons at the top level.
	const statements = ddl
		.split(/;\s*$/m)
		.map((s) => s.trim())
		.filter((s) => s && !s.startsWith('--'));
	for (const stmt of statements) {
		// eslint-disable-next-line no-await-in-loop
		await sql.query(stmt);
	}
	migrated = true;
}
