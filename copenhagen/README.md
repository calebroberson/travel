# Copenhagen — idea board

A small two-person app for planning a trip to Copenhagen.
Vite + React + TypeScript + Tailwind on Supabase, deployed to Vercel as a static SPA.

Two tabs:

- **Ideas** — collect places, vote on them, filter, edit.
- **Days** — turn them into an itinerary: stops in order, how to get between them,
  daylight, and what still needs booking.

Comments, packing and documents are not built yet, though the schema supports them.

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
snapshot (`useFrozenOrder`, owned by the board), not recomputed on every vote. With two voters a single tap
swings a score by up to 3, which is enough to throw a card off screen from under the
thumb that just tapped it. So votes update the card in place, and a "re-sort" button
appears when the frozen order no longer matches what the scores say.

This also settles a conflict in the original spec: a brand-new place has score 0 and
would not sort to the top, yet it should appear there. With a frozen order a new card
is simply prepended, and the next re-sort files it where its score belongs.

## The day planner

Days come from the `trip_day` rows seeded by `schema.sql`, one per trip date. Stops
and travel legs are both `itinerary_item` rows, held in the same normalized store as
places and votes, with the same optimistic-write and realtime pattern. Items reference
places by id and are joined to them client-side; there is no second view.

### Legs belong to the event after them

Stops are items of kind `activity`, `meal` or `logistics`. Legs — how you get from
one stop to the next — are items of kind `transit`, and every leg is attached to the
event that follows it. Moving or re-timing an event moves its legs with it, and
removing an event removes them. That rule is what stops "Metro to Tivoli" from ending
up between breakfast and lunch after Tivoli has moved to the evening. Legs after the
last event are the way back to the hotel.

The schema has no columns for travel mode or duration, so both live in the leg's
title by convention: `Metro · 14 min · M3 from Nørreport`. Every part is optional; a
title that doesn't follow the convention just shows as plain text. See `src/lib/legs.ts`.
Two nullable columns would be tidier if the schema is ever opened up.

### Ordering

Order is manual (the ↑/↓ buttons) but time-aware: giving a stop a start time files it
chronologically among the other *timed* stops, and untimed ones stay where you put
them. A stop that's already in a sensible place doesn't move. Reordering by hand can
put times out of sequence; those stops are flagged rather than silently re-sorted.

`sort_order` is a plain integer, so keys are spaced 1024 apart and new ones go at the
midpoint between neighbours. A day is renumbered only when a gap closes, which takes
about ten inserts in the same spot. See `src/lib/order.ts`.

### Rearrangements are atomic

Every move, re-time or insert that touches more than one row goes out as a single
multi-row `upsert`, which PostgREST runs in one transaction. With one request per row,
a failure partway through could land an event's new position but not its leg's —
silently re-attaching a route to the wrong stop. On failure the app does a forced
refetch and shows the server's state. Rows are sent whole because Postgres checks
`NOT NULL` and `CHECK` constraints on the proposed row even when it becomes an update.

### Things that happen automatically

- **Status.** Scheduling a place marks it `scheduled` on the board, and cards show
  which days it's on. Removing it from the last day puts it back on the shortlist.
  `done` and `skipped` are never overridden.
- **Deleting a scheduled place** keeps the stop, as plain text. Every place-linked
  item stores a snapshot of the place name in `title`. Without it, `place_id`'s
  `ON DELETE SET NULL` would leave a row with neither a place nor a title, violate
  `item_has_subject`, and make the delete fail outright.
- **Saves only send what changed**, in every sheet. That way an edit can't write
  stale values over a change made on the other phone while the sheet was open.

### Daylight, bookings, directions

- **Sunrise and sunset** are computed per day for Copenhagen with the standard sunrise
  equation, in the trip's time zone. It agrees with NOAA's algorithm to within a
  minute. Places marked "needs daylight" are flagged when timed after dark, before
  sunrise, running past sunset, or with under an hour of light left.
- **Reservations**: places that need one but aren't marked booked are flagged on the
  day. Marking one booked (with an optional confirmation number) clears the red
  book-by pill on the board.
- **Directions** hand off to Google Maps with both ends and the leg's mode filled in —
  real transit routing and times, no API key. The day's first leg starts from the
  hotel if one is set. Places route by address when they have one, otherwise by
  name, neighborhood and city.
