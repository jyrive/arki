#!/usr/bin/env node
/**
 * One-shot helper to obtain a Google OAuth refresh token for the Calendar scope.
 *
 * Usage:
 *   pnpm token:google
 *
 * Prereqs:
 *   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set in .env
 *   - http://localhost:53682/callback added as an Authorized redirect URI on the
 *     OAuth client in Google Cloud Console
 */
import http from 'node:http';
import { URL } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';

const ENV_PATH = resolve(process.cwd(), '.env');
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function parseEnv(text) {
	const out = {};
	for (const line of text.split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (m) out[m[1]] = m[2];
	}
	return out;
}

if (!existsSync(ENV_PATH)) {
	console.error('✖ .env not found. Copy .env.example to .env first.');
	process.exit(1);
}
const envText = readFileSync(ENV_PATH, 'utf8');
const env = parseEnv(envText);

const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
	console.error('✖ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.');
	process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

const server = http.createServer(async (req, res) => {
	if (!req.url?.startsWith('/callback')) {
		res.writeHead(404).end();
		return;
	}
	const url = new URL(req.url, `http://localhost:${PORT}`);
	const code = url.searchParams.get('code');
	const err = url.searchParams.get('error');

	if (err || !code) {
		res.writeHead(400, { 'Content-Type': 'text/html' });
		res.end(`<h1>Auth failed</h1><pre>${err ?? 'no code'}</pre>`);
		console.error('✖ Authorization failed:', err);
		server.close();
		process.exit(1);
	}

	try {
		const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: REDIRECT_URI,
				grant_type: 'authorization_code'
			})
		});
		const json = await tokenRes.json();
		if (!tokenRes.ok || !json.refresh_token) {
			throw new Error(JSON.stringify(json, null, 2));
		}

		// Write refresh token into .env
		const updated = envText.includes('GOOGLE_REFRESH_TOKEN=')
			? envText.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${json.refresh_token}`)
			: `${envText.trimEnd()}\nGOOGLE_REFRESH_TOKEN=${json.refresh_token}\n`;
		writeFileSync(ENV_PATH, updated);

		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(
			`<!doctype html><meta charset="utf-8"><title>Done</title>
			 <body style="font-family:system-ui;padding:2rem;max-width:40rem">
			 <h1>✅ Refresh token saved</h1>
			 <p>You can close this tab and restart <code>pnpm dev</code>.</p>
			 </body>`
		);
		console.log('\n✅ GOOGLE_REFRESH_TOKEN written to .env');
		console.log('   Restart `pnpm dev` to pick it up.\n');
		server.close();
	} catch (e) {
		res.writeHead(500, { 'Content-Type': 'text/html' });
		res.end(`<h1>Token exchange failed</h1><pre>${e.message}</pre>`);
		console.error('✖ Token exchange failed:', e.message);
		server.close();
		process.exit(1);
	}
});

server.listen(PORT, () => {
	console.log(`\nListening on ${REDIRECT_URI}`);
	console.log('Opening browser for Google consent…');
	console.log('If it does not open, paste this URL manually:\n');
	console.log(authUrl.toString(), '\n');
	const platform = process.platform;
	const cmd =
		platform === 'darwin' ? 'open' : platform === 'win32' ? 'start ""' : 'xdg-open';
	exec(`${cmd} "${authUrl.toString()}"`, () => {
		/* ignore */
	});
});
