import { getSql } from './db';
import schemaSql from './schema.sql?raw';

let migrated = false;

/**
 * Apply the schema. Idempotent — safe to call before every cron run. Uses
 * in-process memoization so repeated calls inside a single warm serverless
 * instance skip the round-trip.
 */
export async function migrate(): Promise<void> {
	if (migrated) return;
	const sql = getSql();
	const ddl = schemaSql;
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
