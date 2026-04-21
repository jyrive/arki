import { getSql } from './db';

// Schema as inline statements. Keeping it in plain TS avoids any Vite/adapter
// quirks around bundling `.sql` asset files into the serverless output.
// Idempotent — safe to call before every cron tick.
const STATEMENTS: string[] = [
	`CREATE TABLE IF NOT EXISTS events (
		id           TEXT        PRIMARY KEY,
		source       TEXT        NOT NULL,
		kind         TEXT        NOT NULL,
		title        TEXT        NOT NULL,
		start_at     TIMESTAMPTZ NOT NULL,
		end_at       TIMESTAMPTZ NOT NULL,
		all_day      BOOLEAN     NOT NULL DEFAULT false,
		location     TEXT,
		person       TEXT,
		color        TEXT,
		raw          JSONB,
		content_hash TEXT        NOT NULL,
		fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS events_start_idx        ON events (start_at)`,
	`CREATE INDEX IF NOT EXISTS events_source_start_idx ON events (source, start_at)`,
	`CREATE INDEX IF NOT EXISTS events_kind_start_idx   ON events (kind,   start_at)`,
	`CREATE TABLE IF NOT EXISTS source_runs (
		source            TEXT         NOT NULL,
		kind              TEXT         NOT NULL,
		last_attempt_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
		last_success_at   TIMESTAMPTZ,
		last_error        TEXT,
		duration_ms       INT          NOT NULL DEFAULT 0,
		inserted          INT          NOT NULL DEFAULT 0,
		updated           INT          NOT NULL DEFAULT 0,
		unchanged         INT          NOT NULL DEFAULT 0,
		removed           INT          NOT NULL DEFAULT 0,
		window_from       TIMESTAMPTZ,
		window_to         TIMESTAMPTZ,
		PRIMARY KEY (source, kind)
	)`
];

let migrated = false;

export async function migrate(): Promise<void> {
	if (migrated) return;
	const sql = getSql();
	for (const stmt of STATEMENTS) {
		// eslint-disable-next-line no-await-in-loop
		await sql.query(stmt);
	}
	migrated = true;
}
