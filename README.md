# Arki

A simple family dashboard. Aggregates Today / This Week events from Google
Calendar (and later Wilma + MyClub) into one Material Design 3 view that works
on phone, tablet, and desktop.

## Stack

- SvelteKit + Svelte 5
- Tailwind CSS v4 with hand-rolled MD3 design tokens
- TypeScript, Vitest

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in Google credentials (see below)
pnpm dev               # http://localhost:5173
```

Other scripts:

```bash
pnpm check     # type + svelte check
pnpm test      # run unit tests
pnpm build     # production build
pnpm preview   # preview the build
```

## Google Calendar setup (Phase 1)

1. In Google Cloud Console, create an OAuth 2.0 Client (type: **Desktop**).
2. Visit https://developers.google.com/oauthplayground:
   - Click the gear icon, tick **Use your own OAuth credentials**, paste your
     client ID and secret.
   - Select scope `https://www.googleapis.com/auth/calendar.readonly`.
   - Authorize, then exchange the auth code for a refresh token.
3. Put the values into `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REFRESH_TOKEN=...
   GOOGLE_CALENDAR_IDS=primary,family@group.calendar.google.com
   ```

## Roadmap

- ✅ Phase 0 — App skeleton, MD3 tokens, responsive layout
- ✅ Phase 1 — Google Calendar (Today + Week)
- ⏳ Phase 2 — Wilma (unofficial REST API)
- 🗒️ Phase 3 — MyClub (planning only; stub in place)
- ⏳ Phase 4 — Polish: dark-mode toggle, filter chips, PWA, a11y pass

## Project layout

- `src/app.css` — MD3 color/shape/type tokens exposed via Tailwind `@theme`
- `src/lib/components/md3/` — small Svelte MD3 primitives
- `src/lib/server/sources/` — per-source fetchers, all returning `FamilyEvent[]`
- `src/lib/server/aggregate.ts` — combine sources, 60s in-memory cache
- `src/routes/api/events/+server.ts` — JSON API
- `src/routes/+page.svelte` — Today
- `src/routes/week/+page.svelte` — Week agenda
