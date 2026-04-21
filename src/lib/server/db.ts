import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const env = process.env;

function dbPath(): string | null {
	const p = env.SQLITE_PATH?.trim();
	if (!p) return null;
	return resolve(p);
}

/**
 * Returns true when a SQLite database path is configured. Pages and cron
 * probe this; when false, the app falls back to live-fetch every request.
 */
export function hasDb(): boolean {
	return Boolean(dbPath());
}

let cached: Database.Database | null = null;

/**
 * Returns a singleton better-sqlite3 connection. Throws if `SQLITE_PATH`
 * isn't set — call `hasDb()` first.
 */
export function getDb(): Database.Database {
	if (cached) return cached;
	const p = dbPath();
	if (!p) throw new Error('SQLITE_PATH not configured');
	mkdirSync(dirname(p), { recursive: true });
	const db = new Database(p);
	db.pragma('journal_mode = WAL');
	db.pragma('synchronous = NORMAL');
	db.pragma('foreign_keys = ON');
	cached = db;
	return db;
}
