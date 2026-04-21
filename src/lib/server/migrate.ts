import { getDb } from './db';

// SQLite DDL. Timestamps stored as ISO-8601 TEXT (lexically sortable).
// Booleans as INTEGER 0/1. JSON as TEXT.
const STATEMENTS: string[] = [
	`CREATE TABLE IF NOT EXISTS events (
		id           TEXT PRIMARY KEY,
		source       TEXT NOT NULL,
		kind         TEXT NOT NULL,
		title        TEXT NOT NULL,
		start_at     TEXT NOT NULL,
		end_at       TEXT NOT NULL,
		all_day      INTEGER NOT NULL DEFAULT 0,
		location     TEXT,
		person       TEXT,
		color        TEXT,
		raw          TEXT,
		content_hash TEXT NOT NULL,
		fetched_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	)`,
	`CREATE INDEX IF NOT EXISTS events_start_idx        ON events (start_at)`,
	`CREATE INDEX IF NOT EXISTS events_source_start_idx ON events (source, start_at)`,
	`CREATE INDEX IF NOT EXISTS events_kind_start_idx   ON events (kind,   start_at)`,
	`CREATE TABLE IF NOT EXISTS source_runs (
		source            TEXT NOT NULL,
		kind              TEXT NOT NULL,
		last_attempt_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		last_success_at   TEXT,
		last_error        TEXT,
		duration_ms       INTEGER NOT NULL DEFAULT 0,
		inserted          INTEGER NOT NULL DEFAULT 0,
		updated           INTEGER NOT NULL DEFAULT 0,
		unchanged         INTEGER NOT NULL DEFAULT 0,
		removed           INTEGER NOT NULL DEFAULT 0,
		window_from       TEXT,
		window_to         TEXT,
		PRIMARY KEY (source, kind)
	)`
];

let migrated = false;

export async function migrate(): Promise<void> {
	if (migrated) return;
	const db = getDb();
	for (const stmt of STATEMENTS) {
		db.exec(stmt);
	}
	migrated = true;
}
