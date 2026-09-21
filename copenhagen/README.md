# Copenhagen — idea board

A small two-person app for collecting and ranking places to go in Copenhagen.
Vite + React + TypeScript + Tailwind on Supabase, deployed to Vercel as a static SPA.

This is scope one of the trip app: **the idea board only**. Day planning, maps,
comments, packing and documents are not built yet, though the schema supports them.

## Environment

Two variables, both from Supabase → Project Settings → API:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Copy `.env.example` to `.env` and fill both in. `.env` is gitignored and must stay
that way; only `.env.example` is committed.

## Running locally

```bash
npm install
npm run dev
```

Opens on <http://localhost:5173>.

## Supabase setup

The schema is fixed — this app never migrates or alters it. Three things must be
true before the board will show anything:

1. **`schema.sql` has been run** in the SQL editor.
2. **Magic links work.** In Authentication → Providers, turn off email confirmation.
   In Authentication → URL Configuration, add both your Vercel URL and
   `http://localhost:5173` to the redirect allowlist. A missing redirect entry is
   the most common reason a first sign-in fails silently.
3. **Both people have signed in once**, *then* the `trip_member` seed block at the
   bottom of `schema.sql` has been run with their real email addresses.

Until step 3 is done, RLS correctly returns zero rows and the app shows
"You are not on this trip yet." That is the expected first-run state, not a bug.

### If realtime seems dead

Changes made on one phone should appear on the other without a refresh. If they
don't, the cause is almost always the access token: `postgres_changes` on
RLS-protected tables silently delivers nothing unless `supabase.realtime.setAuth()`
has been given the session token. That call lives in `src/state/TripProvider.tsx`
on the auth-state-change handler. Check it before suspecting anything else.

## Deploying to Vercel

The repo root holds unrelated static HTML itineraries, so point the project at this
subdirectory:

| Setting | Value |
|---|---|
| Root Directory | `copenhagen` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Environment Variables for
all three environments. `vercel.json` handles the SPA rewrite so a deep link or a
magic-link return doesn't 404.

After the first deploy, add the production URL to the Supabase redirect allowlist.

## A note on OneDrive

This repo lives inside OneDrive, and `node_modules` is thousands of small files that
OneDrive will try to sync continuously. That causes slow installs and occasional
`EPERM` lock failures on Windows.

If you hit either, exclude it: OneDrive → Settings → Account → Choose folders, and
uncheck `copenhagen/node_modules`. The folder has to exist before it can be
unchecked, so run `npm install` first. Git already ignores it either way.

## How the data flows

Worth knowing before adding anything to this app.

The client **does not store the derived columns** from `place_with_votes`. That view
is queried once, at hydration, and each row is immediately split into a base `place`
record and individual vote entries; `score`, `want_count` and `must_count` are
discarded on arrival.

The reason is that realtime fires on the base tables `place` and `vote`, never on the
view. A vote event carries `{place_id, user_id, value}` and no recomputed score. If
derived columns were state, every event would force either a refetch of that row or a
hand-maintained second copy of the view's aggregation logic, which would then have to
be kept in agreement with the SQL forever.

Instead there are two maps — `places` keyed by id, `votes` keyed by `place_id|user_id`
— and one pure function, `tally()` in `src/lib/tally.ts`, that derives a score from
them. This makes the optimistic path and the realtime path the *same write*: one
entry in one map. The server's echo of your own tap sets the same key to the same
value, so it is idempotent. No flicker, no dedupe bookkeeping, no "was this my own
event" check anywhere.

Adds work the same way: the place id is generated client-side with
`crypto.randomUUID()` so the card can render before the insert lands, and the echo
overwrites that key instead of arriving as a duplicate card.

### Sort order is frozen on purpose

Cards sort by score descending, then `created_at` descending — but the order is a
snapshot held in `order`, not recomputed on every vote. With two voters a single tap
swings a score by up to 3, which is enough to throw a card off screen from under the
thumb that just tapped it. So votes update the card in place, and a "re-sort" button
appears when the frozen order no longer matches what the scores say.

This also settles a conflict in the original spec: a brand-new place has score 0 and
would not sort to the top, yet it should appear there. With a frozen order a new card
is simply prepended, and the next re-sort files it where its score belongs.
