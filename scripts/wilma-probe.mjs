#!/usr/bin/env node
/**
 * Probes Wilma endpoints for your school and dumps raw responses.
 * Helps adjust the mappers in src/lib/server/sources/wilma.ts.
 *
 * Usage:
 *   pnpm wilma:probe                  # uses .env values
 *   pnpm wilma:probe -- --write out/  # also write JSON files to out/
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Load .env manually (no deps).
const envText = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
for (const line of envText.split('\n')) {
	const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
	if (m && !process.env[m[1]]) {
		process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
	}
}

const baseUrl = (process.env.WILMA_BASE_URL || '').replace(/\/$/, '');
const username = process.env.WILMA_USERNAME;
const password = process.env.WILMA_PASSWORD;

if (!baseUrl || !username || !password) {
	console.error('Set WILMA_BASE_URL, WILMA_USERNAME, WILMA_PASSWORD in .env');
	process.exit(1);
}

const writeIdx = process.argv.indexOf('--write');
const outDir = writeIdx >= 0 ? process.argv[writeIdx + 1] || 'wilma-probe' : null;
if (outDir) mkdirSync(outDir, { recursive: true });

function summary(label, value) {
	if (value == null) return `${label}: (null)`;
	if (Array.isArray(value)) return `${label}: [${value.length}] ${value[0] ? JSON.stringify(value[0]).slice(0, 200) : ''}`;
	if (typeof value === 'object') return `${label}: { ${Object.keys(value).slice(0, 8).join(', ')} }`;
	return `${label}: ${String(value).slice(0, 120)}`;
}

async function login() {
	// Wilma requires a pre-login GET to establish a session identifier.
	const pre = await fetch(`${baseUrl}/login`, { redirect: 'manual' });
	const preCookies = (pre.headers.getSetCookie?.() ?? [pre.headers.get('set-cookie') ?? ''])
		.map((c) => c.split(';')[0])
		.filter(Boolean);
	const cookieHeader = preCookies.join('; ');
	const html = await pre.text();
	// Extract hidden SessionID (and any other hidden fields Wilma wants echoed back).
	const sessionId = html.match(/name="SESSIONID"\s+value="([^"]+)"/i)?.[1] ?? '';
	const formKey = html.match(/name="formkey"\s+value="([^"]+)"/i)?.[1] ?? '';

	const body = new URLSearchParams({
		Login: username,
		Password: password,
		SESSIONID: sessionId,
		formkey: formKey,
		CompleteJson: '',
		format: 'json'
	});
	const res = await fetch(`${baseUrl}/login`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			cookie: cookieHeader,
			referer: `${baseUrl}/login`
		},
		body,
		redirect: 'manual'
	});
	const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
	const sid = setCookie.map((c) => c.split(';')[0]).find((c) => c && c.startsWith('Wilma2SID='));
	if (!sid) {
		const text = await res.text().catch(() => '');
		throw new Error(`Login failed (status ${res.status})\n  SESSIONID=${sessionId ? 'yes' : 'NO'} formkey=${formKey ? 'yes' : 'NO'}\n${text.slice(0, 400)}`);
	}
	console.log('✓ login ok:', sid.slice(0, 32) + '...');
	return sid;
}

async function hit(cookie, path, label) {
	const url = `${baseUrl}${path}`;
	try {
		const res = await fetch(url, { headers: { cookie, accept: 'application/json, text/html;q=0.9' } });
		const ct = res.headers.get('content-type') || '';
		console.log(`\n── ${label} [${res.status}] ${ct.split(';')[0]} ──`);
		console.log(`  ${path}`);
		let parsed;
		const text = await res.text();
		if (ct.includes('json')) {
			try {
				parsed = JSON.parse(text);
				if (parsed.error) {
					console.log('  error:', JSON.stringify(parsed.error));
				} else {
					for (const [k, v] of Object.entries(parsed).slice(0, 10)) {
						console.log('  ' + summary(k, v));
					}
				}
			} catch {
				console.log('  (invalid JSON)');
			}
		} else {
			console.log(`  (HTML, ${text.length} bytes)`);
			// Detect role links in homepage
			const roles = [...text.matchAll(/href="\/!([^/"?#]+)\/?"[^>]*>\s*([^<]+?)\s*</g)];
			if (roles.length) {
				console.log('  role links found:');
				for (const [, slug, name] of roles) console.log(`    /!${slug}/  →  ${name.trim()}`);
			}
		}
		if (outDir) {
			const safe = label.replace(/[^a-z0-9]+/gi, '_');
			writeFileSync(join(outDir, `${safe}.${ct.includes('json') ? 'json' : 'html'}`), text);
		}
		return parsed;
	} catch (err) {
		console.log(`  ✗ ${err.message}`);
	}
}

(async () => {
	console.log(`Probing ${baseUrl} as ${username}\n`);
	const cookie = await login();

	await hit(cookie, '/', 'homepage');
	await hit(cookie, '/api/v1/accounts/me', 'accounts_me');
	await hit(cookie, '/index_json', 'index_json');

	// Prompt for a slug to probe child-scoped endpoints
	const slug = process.env.WILMA_PROBE_SLUG;
	if (!slug) {
		console.log('\nTo probe child endpoints, set WILMA_PROBE_SLUG=<slug> from the role links above and re-run.');
		return;
	}
	const today = new Date();
	const weekLater = new Date(today.getTime() + 7 * 864e5);
	const fromDate = today.toISOString().slice(0, 10);
	const toDate = weekLater.toISOString().slice(0, 10);

	// Some Wilma installs require activating the role by GETting the role home first.
	await hit(cookie, `/!${slug}/`, `role_home_${slug}`);

	await hit(cookie, `/!${slug}/schedule/index_json?from=${fromDate}&to=${toDate}`, `schedule_${slug}`);
	await hit(cookie, `/!${slug}/schedule/index_json?p=0`, `schedule_p0_${slug}`);
	await hit(cookie, `/!${slug}/exams/index_json`, `exams_${slug}`);
	await hit(cookie, `/!${slug}/homework/index_json`, `homework_${slug}`);
	await hit(cookie, `/messages/index_json`, 'messages');
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
