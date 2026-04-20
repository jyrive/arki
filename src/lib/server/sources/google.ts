import { env } from '$env/dynamic/private';
import { GoogleAuth } from 'google-auth-library';
import type { FamilyEvent, SourceResult } from '$lib/types/event';

interface GoogleEventDateTime {
	dateTime?: string;
	date?: string;
	timeZone?: string;
}

interface GoogleEvent {
	id: string;
	summary?: string;
	location?: string;
	start: GoogleEventDateTime;
	end: GoogleEventDateTime;
	attendees?: { email?: string; displayName?: string }[];
}

interface GoogleEventsResponse {
	items?: GoogleEvent[];
	nextPageToken?: string;
}

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth | null {
	if (cachedAuth) return cachedAuth;

	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	const refreshToken = env.GOOGLE_REFRESH_TOKEN;

	if (clientId && clientSecret && refreshToken) {
		// OAuth2 user (refresh token) flow — recommended for personal calendars.
		// Use raw fetch w/ token endpoint to keep deps minimal.
		cachedAuth = {
			// Simulated GoogleAuth interface; we only need getAccessToken-like behaviour.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			getClient: async () => ({}) as any,
			getAccessToken: async () => fetchOAuthAccessToken(clientId, clientSecret, refreshToken)
		} as unknown as GoogleAuth;
		return cachedAuth;
	}

	const saJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
	if (saJson) {
		cachedAuth = new GoogleAuth({
			scopes: SCOPES,
			credentials: JSON.parse(saJson)
		});
		return cachedAuth;
	}

	return null;
}

async function fetchOAuthAccessToken(
	clientId: string,
	clientSecret: string,
	refreshToken: string
): Promise<string> {
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		})
	});
	if (!res.ok) {
		throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
	}
	const json = (await res.json()) as { access_token: string };
	return json.access_token;
}

function normalize(ev: GoogleEvent, calendarColor?: string): FamilyEvent {
	const allDay = Boolean(ev.start.date && !ev.start.dateTime);
	return {
		id: `google:${ev.id}`,
		source: 'google',
		title: ev.summary ?? '(no title)',
		start: (ev.start.dateTime ?? ev.start.date)!,
		end: (ev.end.dateTime ?? ev.end.date)!,
		allDay,
		location: ev.location,
		attendees: ev.attendees?.map((a) => a.displayName ?? a.email ?? '').filter(Boolean),
		color: calendarColor
	};
}

export async function fetchGoogleEvents(from: Date, to: Date): Promise<SourceResult> {
	const auth = getAuth();
	if (!auth) {
		return { source: 'google', events: [], error: 'Google credentials not configured' };
	}

	const calendarIds = (env.GOOGLE_CALENDAR_IDS ?? 'primary')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	try {
		const token = await auth.getAccessToken();
		if (!token) throw new Error('No access token');

		const all: FamilyEvent[] = [];
		for (const id of calendarIds) {
			const url = new URL(
				`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`
			);
			url.searchParams.set('timeMin', from.toISOString());
			url.searchParams.set('timeMax', to.toISOString());
			url.searchParams.set('singleEvents', 'true');
			url.searchParams.set('orderBy', 'startTime');
			url.searchParams.set('maxResults', '250');

			const res = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) {
				throw new Error(`Calendar ${id}: ${res.status} ${await res.text()}`);
			}
			const data = (await res.json()) as GoogleEventsResponse;
			for (const ev of data.items ?? []) all.push(normalize(ev));
		}
		return { source: 'google', events: all };
	} catch (err) {
		return {
			source: 'google',
			events: [],
			error: err instanceof Error ? err.message : String(err)
		};
	}
}
