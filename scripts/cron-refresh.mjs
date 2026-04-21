#!/usr/bin/env node
// Local cron trigger. Reads CRON_SECRET from .env and POSTs to the dev server.
// Usage: pnpm cron:refresh [url]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, '..', '.env');

const env = {};
try {
	for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
		const m = line.match(/^([A-Z_]+)=(.*)$/);
		if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
	}
} catch {
	// ignore
}
Object.assign(process.env, env);

const baseUrl = process.argv[2] ?? 'http://localhost:5173';
const secret = process.env.CRON_SECRET;
if (!secret) {
	console.error('CRON_SECRET not set in .env');
	process.exit(1);
}

const res = await fetch(`${baseUrl}/api/cron/refresh`, {
	method: 'POST',
	headers: { authorization: `Bearer ${secret}` }
});
const body = await res.text();
console.log(res.status, res.statusText);
try {
	console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
	console.log(body);
}
process.exit(res.ok ? 0 : 1);
