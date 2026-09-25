# Finifeed — Product & Technical Specification

**Version:** 0.3  
**Date:** 2026-09-25  
**Status:** Implementation draft  
**Working brand:** Finifeed  
**Tagline:** *Your creator inbox.*  
**Product promise:** *A feed you can actually finish.*

---

## 1. Purpose of this document

This document is the implementation source of truth for the first version of **Finifeed**. It is intentionally written so that a coding agent can derive implementation plans, tickets, database migrations, API endpoints, UI screens, and tests from it without inventing the product along the way.

When this document conflicts with an implementation convenience, **this document wins unless it is explicitly amended**.

The first release is deliberately narrow: prove that people want a finite, creator-centric inbox before investing in broad social-platform aggregation.

## 1.1 Changelog

### 0.3 (2026-09-25) — TypeScript end-to-end on Bun

Decision: the backend is written in TypeScript on the Bun runtime instead of Kotlin/Ktor/JVM. Rationale: since 0.2 the client is a Vue/TypeScript web app, so the original reason for a JVM stack (sharing code with a Kotlin Multiplatform client) no longer applies. One language and one toolchain shorten the path to validation, and API types can be shared between client and server. Consequences:

- **Backend stack** is Bun + Hono + PostgreSQL + Kysely, plain SQL migrations, Zod, `bun test` (§14.1).
- **Repository** is a Bun workspace monorepo with `apps/server`, `apps/web`, `packages/shared` (§14.2).
- Flyway / Gradle / Kotlin-specific rules are replaced by their TypeScript equivalents (§10.1, §14, §23 Slice 0, §25, §27).
- Domain model, API contract, slices and non-goals are unchanged.

### 0.2 (2026-08-27) — Fastest path to hypothesis validation

Decision: validate the product hypothesis as quickly as possible with a small closed beta. Consequences:

- **Client is a web application** (Vue 3 + Vite + TypeScript), not Kotlin Multiplatform / Compose Multiplatform. Native mobile is deferred until the hypothesis is confirmed (§15).
- **New-content detection uses the official YouTube channel RSS feed** (no quota). The Data API is used for the initial backlog and for item details (§11.3).
- **`videos.list` is required** for duration; `playlistItems.list` does not return it (§11.1).
- **Shorts toggle replaced by a per-user minimum duration filter** (`minDurationSeconds`, 0 = show everything). No Shorts classification at ingestion; the filter is a plain duration comparison in the inbox query (§6.7).
- **Authentication is a minimal magic-link flow**, no OIDC provider during validation (§16).
- **YouTube subscription import (OAuth) is deferred** to post-validation (§11.5, §13.5, Slice 6).
- Slice 0, 4, 5, 6, 7 updated accordingly. Domain model, API contract and backend architecture are unchanged.

---

# 2. Product vision

## 2.1 One-sentence pitch

**Finifeed is a finite inbox for content from the creators you intentionally follow — without recommendations, infinite scroll, trending content, or an algorithm deciding what deserves your attention.**

## 2.2 Problem

People often want the content of specific creators but do not want the consumption mechanics of YouTube, Instagram, TikTok, and similar platforms:

- recommendation feeds keep introducing unrelated content;
- infinite scroll removes a natural stopping point;
- Shorts/Reels/TikToks can dominate attention even when the user opened the app for a specific creator;
- subscriptions are fragmented across platforms;
- the same creator may publish on multiple services;
- users cannot easily answer: **“What is new from the people I deliberately chose to follow?”**

Finifeed should answer exactly that question and then allow the user to be **done**.

## 2.3 Product principles

These are non-negotiable product rules.

1. **Finite by design**  
   Every inbox has an end. No infinite scrolling of newly discovered content.

2. **Explicit follows only**  
   Content appears because the user followed a creator/source, not because Finifeed predicted interest.

3. **No recommendation algorithm**  
   Finifeed may sort using transparent user-controlled rules, but it must not introduce creators or content into the inbox based on engagement optimization.

4. **Creator first, platform second**  
   The long-term domain model is `Creator -> Sources -> Content`, not `Platform -> Feed`.

5. **Inbox, not feed**  
   New items have a state. The user handles them and they leave the inbox.

6. **Attention is the scarce resource**  
   Product decisions should optimize for useful completion, not session duration.

7. **No platform-rule shortcuts**  
   Do not build the business around prohibited scraping or reverse-engineered private APIs.

8. **KISS**  
   Start as one backend, one database, one client codebase. No microservices, message broker, event sourcing, distributed cache, or speculative infrastructure in the MVP.

---

# 3. Positioning

## 3.1 Brand hierarchy

**Brand:** Finifeed  
**Category:** Creator inbox  
**Primary tagline:** *Your creator inbox.*  
**Secondary promise:** *A feed you can actually finish.*

Possible homepage copy:

> **Follow creators, not algorithms.**  
> Finifeed gives you one finite inbox for the people you intentionally follow. Catch up, dismiss what you do not need, and get on with your day.

## 3.2 What Finifeed is not

Finifeed is **not**:

- a YouTube replacement;
- an ad blocker;
- a TikTok/Instagram clone;
- a general social network;
- a discovery engine;
- an RSS reader with a different skin;
- a recommendation algorithm;
- a content downloader or media mirror.

The product's value is **selection, aggregation, state, organization, and completion**.

---

# 4. Target user

## 4.1 Primary persona

A technically comfortable or digitally conscious user who:

- follows 10–100 creators;
- regularly uses YouTube and possibly Instagram/TikTok/podcasts/blogs;
- values some creator content but dislikes recommendation feeds and doomscrolling;
- wants a deliberate, chronological workflow;
- is willing to curate a smaller list of creators rather than consume a platform-wide feed.

## 4.2 Jobs to be done

> When creators I care about publish something, I want one place to see it so I do not have to open several algorithmic apps.

> When I open Finifeed, I want to decide what to watch/read, postpone, or dismiss so that I can reach inbox zero.

> When one creator publishes across several platforms, I eventually want to follow the creator once rather than manage every profile independently.

---

# 5. MVP hypothesis

The MVP tests this hypothesis:

> **Users prefer managing new creator content as a finite inbox over browsing an algorithmic subscription/feed experience.**

The MVP does **not** need to prove multi-platform aggregation yet.

## 5.1 MVP source scope

### Supported in MVP

- **YouTube**

### Designed for, but not implemented in MVP

- RSS / blogs
- podcasts
- Instagram Professional accounts
- TikTok
- Bluesky
- Mastodon
- newsletters

The source abstraction must exist from day one, but only the YouTube adapter is implemented initially.

## 5.2 Validation strategy

The goal is the **shortest path to Slice 3 in the hands of real testers**, not the most complete first version.

- Client: web app delivered as a link. No app store, no TestFlight, no native builds.
- Testers: 20–50 people, closed beta, roughly 3 weeks.
- Onboarding: testers add creators by handle. No subscription import. A tester who does not type in at least a handful of handles most likely does not have the problem Finifeed solves — that is a signal, not a defect.
- Success: metrics in §20 plus one qualitative question asked to every tester at the end: *"Would you be disappointed if Finifeed disappeared tomorrow?"*

Everything that does not shorten this path (native mobile, OAuth import, OIDC auth, per-creator rules) is deferred.

---

# 6. MVP user experience

## 6.1 Core navigation

The MVP has four top-level destinations:

1. **Inbox**
2. **Later**
3. **Creators**
4. **Settings**

No Discover or Trending tab exists.

## 6.2 First-run onboarding

### Screen 1 — Promise

Show:

> **Your creator inbox.**  
> Follow the people you care about. No recommendations. No infinite scroll.

Primary CTA: **Get started**

### Screen 2 — Add creators

The user can initially add YouTube creators by:

- pasting a YouTube channel URL;
- entering a YouTube handle such as `@Fireship`.

Importing existing YouTube subscriptions via OAuth is **deferred to post-validation** (§11.5).

Do not require general YouTube keyword search for the first vertical slice.

### Screen 3 — Inbox

After at least one creator has been added, open the inbox.

## 6.3 Inbox

Each item shows only useful triage information:

- creator name;
- platform badge;
- content type;
- thumbnail if available;
- title;
- publication time/date;
- duration if available;
- optional `Short` badge, derived in the client from duration (≤ 3 minutes), purely visual.

Primary actions:

- **Open**
- **Later**
- **Dismiss**

### Semantics

**Open**
- immediately removes the item from Inbox by marking it `DONE`;
- opens the canonical platform URL (YouTube app/browser in MVP);
- provides a short undo opportunity in the UI.

**Later**
- removes the item from Inbox;
- places it in Later.

**Dismiss**
- removes the item from Inbox;
- does not open the content;
- stores the decision so the item does not reappear.

This design is intentional. Finifeed does not need perfect playback tracking to maintain an honest finite inbox.

## 6.4 Inbox zero

If no unhandled items remain, show a deliberate completion screen:

> **You’re all caught up.**

Optional secondary text:

> Nothing else needs your attention here.

Do not fill the empty state with recommendations.

## 6.5 Later

Later contains items explicitly postponed by the user.

Actions:

- Open
- Dismiss
- Move back to Inbox

Sort order in MVP: newest publication first.

No infinite content discovery is allowed at the bottom.

## 6.6 Creators

Show followed creators, alphabetically by default.

Each row contains:

- creator avatar;
- creator name;
- connected source badges;
- priority (future-ready, optional in UI for first slice).

Creator detail screen:

- creator name/avatar;
- source accounts;
- follow/unfollow;
- future: per-creator minimum duration override (not in validation MVP);
- future placeholder in domain only for per-source content rules.

## 6.7 Minimum duration filter (replaces a Shorts toggle)

The YouTube Data API exposes no official "is a Short" flag, and users differ in what they consider noise. Instead of guessing, Finifeed lets each user set a **minimum duration**:

- setting: `minDurationSeconds`, per user, global across all creators;
- `0` means **show everything**;
- default: **180** (hides typical Shorts);
- items with unknown duration are **never** hidden by this filter;
- applied in the inbox query (§17.2), not at ingestion. Changing the setting immediately changes which items are eligible, including items already synced.

### Settings UI

One control, explainable in one sentence: *"Only show videos longer than …"*

Presets are enough for MVP:

```text
All videos | 30 s | 1 min | 3 min | 10 min
```

plus a free number input if it is cheap to add.

### Rules

- no Shorts classification is stored; `content_items.kind` for YouTube is always `YOUTUBE_VIDEO` in MVP;
- the filter is a plain comparison `duration_seconds >= minDurationSeconds OR duration_seconds IS NULL`;
- an item hidden by the filter is not "handled" — it simply is not eligible. Lowering the threshold later makes it appear if it is still newer than `inboxFrom` and has no user state;
- optional per-creator override can be added after validation.

Never scrape private page internals just to classify Shorts.

---

# 7. Transparent ordering

The inbox is **not ranked by engagement**.

MVP ordering:

1. priority descending if user priorities are enabled;
2. publication date descending.

Default priority: `NORMAL`.

Future priorities:

- HIGH
- NORMAL
- LOW

The ordering rule should be explainable in one sentence in Settings.

---

# 8. Domain model

The domain model must be source-agnostic from the beginning.

## 8.1 Creator

A human, organization, show, or publishing identity the user conceptually follows.

Example:

```text
Creator: Marques Brownlee
  -> YouTube: @mkbhd
  -> Instagram: @mkbhd        [future]
  -> TikTok: @mkbhd           [future]
  -> Podcast: Waveform        [future]
```

A Creator is **not** the same as a YouTube channel.

## 8.2 SourceAccount

A creator's identity on one external source.

Fields conceptually include:

- id
- creatorId
- sourceType
- externalId
- handle
- displayName
- canonicalUrl
- avatarUrl
- metadata
- sync status

`(source_type, external_id)` must be unique.

## 8.3 ContentItem

A normalized piece of creator content.

Examples:

- YouTube video
- YouTube Short
- Instagram post
- Instagram Reel
- TikTok video
- blog article
- podcast episode

Core fields:

- id
- sourceAccountId
- externalId
- kind
- title
- summary/description (optional)
- canonicalUrl
- thumbnailUrl
- publishedAt
- durationSeconds (optional)
- rawMetadata / sourceMetadata JSON (only fields needed for debugging/adaptation)
- discoveredAt

`(source_account_id, external_id)` must be unique.

## 8.4 UserSubscription

Represents a user's decision to follow a Creator.

Fields:

- userId
- creatorId
- priority
- followedAt
- inboxFrom
- active

`inboxFrom` defines the oldest publication time eligible to appear as new content for that subscription.

Default on initial follow:

```text
inboxFrom = now - 7 days
```

This gives the user a small useful initial inbox without importing years of backlog.

## 8.5 UserSourcePreference

Future-ready settings that allow a user to follow a Creator but control individual sources/content types.

Example:

```text
Creator: MKBHD
YouTube long-form: ON
YouTube Shorts: OFF
Instagram posts: ON
Instagram Reels: OFF
TikTok: OFF
```

For MVP, implement only the global minimum duration filter (§6.7). Do not build a generic rules engine.

## 8.6 UserContentState

A per-user decision about a ContentItem.

States:

- `LATER`
- `DONE`
- `DISMISSED`

**NEW/INBOX should be implicit**: a content item belongs to a followed source, is newer than the subscription's `inboxFrom`, passes source/content filters, and has no terminal/user state row.

This avoids creating one database row for every `(user, content_item)` combination merely because an item exists.

---

# 9. Suggested relational schema

The exact SQL types are implementation details, but the shape should remain close to this.

```text
users
- id UUID PK
- email
- created_at
- updated_at

creators
- id UUID PK
- display_name
- avatar_url nullable
- created_at
- updated_at

source_accounts
- id UUID PK
- creator_id FK creators
- source_type varchar/enum
- external_id
- handle nullable
- display_name
- canonical_url
- avatar_url nullable
- source_metadata jsonb
- last_synced_at nullable
- sync_status
- created_at
- updated_at
UNIQUE(source_type, external_id)

content_items
- id UUID PK
- source_account_id FK source_accounts
- external_id
- kind
- title
- description nullable
- canonical_url
- thumbnail_url nullable
- published_at
- duration_seconds nullable
- source_metadata jsonb
- discovered_at
- updated_at
UNIQUE(source_account_id, external_id)
INDEX(source_account_id, published_at DESC)

user_subscriptions
- id UUID PK
- user_id FK users
- creator_id FK creators
- priority
- followed_at
- inbox_from
- active
UNIQUE(user_id, creator_id)

user_content_states
- user_id FK users
- content_item_id FK content_items
- state
- changed_at
PRIMARY KEY(user_id, content_item_id)
INDEX(user_id, state, changed_at DESC)

user_preferences
- user_id PK/FK users
- min_duration_seconds integer not null default 180   (0 = show everything)
- created_at
- updated_at
```

Add a separate `source_sync_state` table only when an adapter needs cursors or state that does not fit cleanly on `source_accounts`. Do not add it speculatively.

---

# 10. Source adapter architecture

## 10.1 Goal

Platform-specific code must not leak into Inbox or subscription business logic.

Conceptual interface:

```ts
interface ContentSourceAdapter {
  readonly sourceType: SourceType;

  resolveAccount(input: SourceAccountInput): Promise<ResolvedSourceAccount>;

  fetchRecentContent(
    account: SourceAccount,
    since: Date | null,
  ): Promise<ExternalContentItem[]>;
}
```

Do not create a complex plugin framework. One interface plus source-specific implementations is enough.

Initial implementation:

```text
ContentSourceAdapter
└── YouTubeSourceAdapter
```

Future:

```text
├── RssSourceAdapter
├── PodcastSourceAdapter
├── InstagramSourceAdapter
└── TikTokSourceAdapter
```

## 10.2 Normalization boundary

All external representations must be converted at the adapter boundary to domain-neutral DTOs.

The rest of Finifeed must never need to know what a YouTube `playlistItem` response looks like.

---

# 11. YouTube MVP integration

## 11.1 Official APIs and feeds

Use the official YouTube Data API plus the official per-channel RSS feed. Both are public, documented mechanisms; no scraping is involved.

Verified as of 2026-08-27:

- `channels.list` supports resolving channels by `forHandle`; cost is 1 quota unit.
- `channels.list` can return the channel's uploads playlist in `contentDetails.relatedPlaylists.uploads`.
- `playlistItems.list` retrieves videos from an uploads playlist; cost is 1 unit. **It does not return video duration.**
- `videos.list` with `part=contentDetails,snippet` returns duration (ISO 8601) and details for up to 50 video IDs per request; cost is 1 unit per request.
- `subscriptions.list(mine=true)` can import the authenticated user's subscriptions; cost is 1 unit per request, up to 50 results per page. Requires an OAuth scope that Google classifies as sensitive; app verification is needed before non-test users can use it. **Deferred.**
- the default project quota is 10,000 units/day and quota extensions can be requested (audit process, not instant).
- every channel exposes an official Atom feed at `https://www.youtube.com/feeds/videos.xml?channel_id={channelId}` containing the ~15 most recent uploads (video ID, title, published time, thumbnail via `media:group`; **no duration**). It does not consume API quota.

### Quota budget

Polling every channel via `playlistItems.list` alone would consume ~24 units per channel per day at a 60-minute interval, i.e. ~400 channels per default quota — too little for 50 testers. Therefore:

- **RSS feed** = detection of new uploads (free);
- **`videos.list`** = details for newly detected videos only, batched 50 per request;
- **`playlistItems.list`** = initial backlog only, once per source account.

With this split the API cost is roughly proportional to the number of *new videos*, not to the number of channels × polling frequency.

### YouTube API Services policy notes

Check and document before public beta:

- API data stored by Finifeed must be refreshed or deleted within the retention window defined by the YouTube API Services Developer Policies (30 days at time of writing, with exceptions). Implement a periodic refresh/cleanup for content metadata.
- Content must link back to YouTube (canonical URLs — already the case).
- Register the project and OAuth consent screen early; verification for sensitive scopes takes weeks (only relevant once Slice 6 is picked up).

References:

- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/v3/docs/subscriptions/list
- https://developers.google.com/youtube/v3/getting-started
- https://developers.google.com/youtube/terms/developer-policies

## 11.2 Resolving a creator

Accepted MVP input:

- `@handle`
- `https://www.youtube.com/@handle`
- canonical channel ID / URL where easily parseable

Process:

1. parse and normalize input;
2. resolve via `channels.list` using `forHandle` or `id`;
3. retrieve `snippet` + `contentDetails`;
4. upsert `Creator` and `SourceAccount`;
5. persist uploads playlist ID in source metadata;
6. perform initial recent-content sync.

Do not use YouTube keyword search for the first vertical slice.

## 11.3 Content synchronization

Two modes, both inside `YouTubeSourceAdapter`:

### Initial sync (once per source account, on first follow)

1. obtain uploads playlist ID from source metadata;
2. call `playlistItems.list` for the most recent items;
3. stop paging when content is older than the required sync horizon;
4. call `videos.list` (batched, 50 IDs per request) for duration and details;
5. upsert `ContentItem`s with `durationSeconds`;
6. update `lastSyncedAt` only after a successful sync.

### Initial sync horizon

Fetch enough recent content to cover at least the default 7-day subscription backlog. A safe cap (e.g. max 2 pages / 100 items) should prevent pathological history imports.

### Incremental sync (background polling)

1. fetch the channel's Atom feed `https://www.youtube.com/feeds/videos.xml?channel_id={channelId}`;
2. compare video IDs against existing `ContentItem`s for the source account;
3. for unseen IDs only: call `videos.list` (batched across source accounts where practical);
4. upsert with `durationSeconds`;
5. update `lastSyncedAt` only after a successful sync.

The feed contains only the ~15 most recent uploads. If a channel publishes more than that between two polls, the remainder is caught by a fallback `playlistItems.list` call when the oldest feed entry is still unseen. Log this case; it should be rare.

### Background polling parameters

For beta/MVP:

- poll active YouTube source accounts periodically;
- start at approximately **30–60 minutes** (RSS is free, so the interval is bounded by politeness and server load, not quota);
- poll each unique source account globally, not once per user;
- send `If-None-Match` / `If-Modified-Since` where the feed supports it;
- log quota usage of every Data API call;
- make the interval configurable.

Do not build a distributed scheduler in MVP. A database-backed/simple in-process worker is sufficient while running one backend instance.

Before scaling horizontally, implement a database lease/advisory lock or move jobs to a proper worker. Do not solve that before needed.

## 11.4 Playback

MVP does **not** need an in-app YouTube player.

On `Open`:

1. mark item `DONE`;
2. open the canonical YouTube URL using an app deep link/browser;
3. allow Undo inside Finifeed.

This keeps the product focused on the inbox and reduces player/API-policy complexity.

An official embedded player can be evaluated later.

## 11.5 YouTube subscription import — DEFERRED (post-validation)

Not part of the validation MVP. Reasons: requires a sensitive OAuth scope, Google app verification (weeks), encrypted token storage, and it works against curation. Testers add creators by handle instead (§5.2).

Keep this section as the design for when it is picked up.

Flow:

1. user connects YouTube via OAuth;
2. request the minimum read scope needed;
3. paginate `subscriptions.list(mine=true)`;
4. show an import selection screen;
5. user selects which subscriptions become Finifeed Creators;
6. resolve/upsert selected channels;
7. do **not** automatically import every subscription without confirmation.

The product is intentionally curated; import should not recreate a 500-channel noisy subscription list by default.

---

# 12. Instagram and TikTok strategy — NOT MVP

These adapters must not be implemented until the YouTube MVP proves the core behavior.

## 12.1 Instagram

Current official Instagram APIs are oriented toward Professional accounts (Business/Creator), and Meta documents access to basic metadata/metrics about other Instagram Businesses and Creators through its Facebook Login API path. Consumer/personal accounts are not generally accessible through that path.

Reference:

- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

Before implementation, run a dedicated technical + policy spike and record the exact approved endpoint, permissions, review requirements, rate limits, data-retention obligations, and whether the Finifeed consumer-reader use case is accepted.

**No Instagram scraper in the core product.**

## 12.2 TikTok

TikTok's official Display API can return a TikTok user's profile and recent videos, but it requires that TikTok user to authorize the Finifeed application via OAuth/Login Kit.

TikTok also provides an official creator-profile embed that can show up to ten recent videos for public eligible profiles.

References:

- https://developers.tiktok.com/docs/en/display-api-overview
- https://developers.tiktok.com/docs/en/display-api-get-started
- https://developers.tiktok.com/docs/en/embed-creator-profiles

Strategy:

- do not promise arbitrary TikTok ingestion in MVP;
- future option A: creator opt-in/claim flow using the Display API;
- future option B: official profile/video embeds where useful;
- do not build the business on scraping arbitrary TikTok profiles.

---

# 13. API design

Use REST for MVP. Keep routes boring and explicit.

Prefix: `/api/v1`

## 13.1 Inbox

```http
GET /api/v1/inbox?cursor=&limit=50
```

Returns currently unhandled items for the authenticated user.

```http
POST /api/v1/content/{contentId}/later
POST /api/v1/content/{contentId}/done
POST /api/v1/content/{contentId}/dismiss
DELETE /api/v1/content/{contentId}/state
```

The delete endpoint resets the item to its implicit NEW state if it is still eligible for the inbox.

## 13.2 Later

```http
GET /api/v1/later?cursor=&limit=50
```

## 13.3 Creators / subscriptions

```http
GET    /api/v1/creators
POST   /api/v1/creators/resolve
POST   /api/v1/subscriptions
PATCH  /api/v1/subscriptions/{subscriptionId}
DELETE /api/v1/subscriptions/{subscriptionId}
```

Possible resolve request:

```json
{
  "sourceType": "YOUTUBE",
  "input": "@Fireship"
}
```

Resolve should not automatically follow. It returns a candidate so the user can confirm.

## 13.4 Preferences

```http
GET   /api/v1/preferences
PATCH /api/v1/preferences
```

MVP setting:

```json
{
  "minDurationSeconds": 180
}
```

`0` = show everything. Validation: integer, `>= 0`, sensible upper bound (e.g. 24 h).

## 13.5 Import — DEFERRED (post-validation)

Not implemented during validation. Reserved routes:

```http
POST /api/v1/integrations/youtube/connect
GET  /api/v1/integrations/youtube/subscriptions
POST /api/v1/integrations/youtube/import
```

Exact OAuth callback endpoints can be implementation-specific.

---

# 14. Backend architecture

## 14.1 Recommended stack

Use a simple TypeScript backend on Bun:

- **Bun** as runtime, package manager (workspaces) and test runner (`bun test`)
- TypeScript in `strict` mode, executed directly by Bun (no separate build step for the server)
- **Hono** as HTTP framework
- PostgreSQL
- **Kysely** as typed SQL query builder over the `postgres` (postgres.js) driver; complex queries such as the Inbox query may use Kysely's `sql` template directly. No ORM with its own schema DSL (no Prisma, no TypeORM).
- **Plain SQL migrations** (`apps/server/migrations/NNNN_description.sql`), applied in order inside a transaction by a small in-repo runner that records applied files in a `schema_migrations` table. Runs on server start and via `bun run migrate`.
- **Zod** for request validation and the shared API contract
- structured JSON logging (e.g. pino) with request IDs
- Testcontainers (`@testcontainers/postgresql`) for integration tests. Its compatibility with Bun must be verified in Slice 0; if it is not reliable, fall back to a disposable PostgreSQL started via `docker compose` for the test run and document this.

Use `Bun.serve`, `fetch` and other Bun/web-standard APIs where they cover the need; do not add dependencies for them.

The exact versions (including Bun, pinned via `packageManager` / `.bun-version`) should be pinned and updated intentionally.

## 14.2 Repository layout and packaging by feature

Bun workspace monorepo:

```text
apps/
  server/        Bun + Hono backend
  web/           Vue 3 + Vite client
packages/
  shared/        API DTOs, Zod schemas, error codes, enums shared by server and web
```

`packages/shared` contains only the API contract (types, schemas, constants). It must not contain server-side business logic or database code.

Inside the server, prefer feature/domain folders over generic technical buckets:

```text
apps/server/src/
  auth/
  creators/
  subscriptions/
  content/
  inbox/
  preferences/
  sources/
    youtube/
  jobs/
  database/
  config/
```

Within a feature, separate transport/domain/persistence only when it materially improves clarity.

Avoid architectures where a simple action crosses eight layers of boilerplate.

## 14.3 Module conventions

- One primary exported class/interface/type per file where it improves navigability; small closely related types (e.g. a DTO and its schema) may share a file.
- Prefer plain functions and object literals over classes unless state or an interface implementation makes a class clearer.
- No barrel files (`index.ts` re-exporting a whole folder) inside the server.

## 14.4 Transactions

Use explicit transaction boundaries (`db.transaction()`) in application services for operations that update multiple persistent records.

Do not allow Hono route handlers to contain business rules.

## 14.5 External HTTP

All source API calls must go through source clients/adapters so they can be tested using fixture responses without real API calls. Source clients receive their `fetch` function (and API key/base URL) via constructor/factory parameters so tests can inject a fake `fetch` serving fixtures; no global HTTP mocking library is required.

Persist only data Finifeed actually needs. Do not mirror entire upstream responses indefinitely.

---

# 15. Client architecture

## 15.1 Recommended direction

The validation client is a **web application**:

- Vue 3 with Composition API and `<script setup>`
- TypeScript
- Vite
- Vue Router
- a small store (Pinia) only if component-local state becomes awkward
- served as static files; talks to the backend via `/api/v1`
- API types and Zod schemas imported from `packages/shared`
- dependencies installed and scripts run via Bun; `vue-tsc` for type checking

Rationale: the MVP is a list with three actions. A web app reaches testers through a link, needs no app store or TestFlight, and removes native build friction from the critical path. On phones, canonical `youtube.com` URLs open the YouTube app via the OS link handler, so `Open` works without any native code.

Requirements:

- mobile-first responsive layout; the inbox must be comfortable to triage on a phone;
- installable as a basic PWA (manifest + icon) is nice-to-have, not required;
- no offline mode.

### After validation

If the hypothesis is confirmed, native clients (Kotlin Multiplatform + Compose Multiplatform, or platform-native) can be added on top of the unchanged REST contract. Target order then: Android/iOS, desktop later. Do not start native work before validation results exist.

## 15.2 Client state

Keep client state simple:

- server is source of truth for subscriptions and inbox state;
- optimistic mutations for Later/Done/Dismiss;
- undo restores the previous server state;
- local cache is optional and should not become an offline-first synchronization project in MVP.

## 15.3 Pagination

Use cursor pagination. Do not implement page-number pagination for the inbox.

The UI may render in batches but must communicate a finite result set, not an endless discovery surface.

---

# 16. Authentication

Authentication is required before the closed beta because state must sync across devices and testers must not see each other's data.

Do not let auth block the first local vertical slice.

Recommended implementation order:

1. development `TestUser` / local auth bypass;
2. complete core vertical slice;
3. add **minimal magic-link authentication** for the closed beta (below);
4. evaluate a standard OIDC/OAuth-capable provider only after validation, if needed.

### Closed-beta authentication (validation MVP)

- passwordless magic link: user enters email, receives a single-use, time-limited login link, backend sets an HTTP-only session cookie;
- tester allowlist: only invited emails can log in;
- session table in PostgreSQL; no JWT infrastructure;
- transactional email via one simple provider; in development, log the link instead of sending it;
- no passwords are ever stored.

This is deliberately small. It should take days, not weeks.

External OAuth tokens (e.g. future YouTube import) must be:

- requested with least privilege;
- encrypted at rest;
- revocable;
- deletable when the integration is disconnected/account deleted.

---

# 17. Background jobs

Required MVP jobs:

## 17.1 `SyncSourceAccountsJob`

- finds due source accounts;
- invokes adapter;
- upserts content;
- records success/failure;
- uses bounded concurrency;
- retries transient failures with backoff;
- does not retry permanent 4xx conditions indefinitely.

## 17.2 No per-user fan-out job

Do not copy every new content item into every follower's inbox.

Inbox membership is computed from:

```text
user subscription
+ creator/source relation
+ publication time
+ filters
- existing user content state
```

This is a core scaling decision.

---

# 18. Privacy, platform policy, and content ownership

MVP requirements:

- do not download/rehost YouTube video files;
- store metadata and canonical links only;
- respect upstream removals by updating/deactivating unavailable content when discovered;
- provide account deletion;
- delete user-specific state and OAuth tokens when requested;
- store only necessary creator/source metadata;
- document third-party content sources in Privacy Policy/Terms before public launch;
- do not use prohibited scraping for Instagram/TikTok to “complete” platform support.

A future adapter must include a short policy note in code/docs describing the official data-access mechanism and relevant restrictions.

---

# 19. Observability

MVP backend should expose:

- structured logs;
- request IDs;
- source sync success/failure logs;
- sync duration;
- items discovered per sync;
- upstream HTTP status/limited error metadata;
- YouTube quota/request counters where practical.

Do not add a complex observability stack solely for the prototype. The app must be debuggable before it is observable at enterprise scale.

---

# 20. Product analytics

If analytics is added, collect product behavior, not invasive content profiling.

Useful events:

- `onboarding_completed`
- `creator_followed`
- `creator_unfollowed`
- `content_opened`
- `content_later`
- `content_dismissed`
- `inbox_zero_reached`
- `youtube_import_started`
- `youtube_import_completed`

Important metrics:

### Activation

User has:

- followed >= 3 creators; and
- handled >= 3 content items.

### Core engagement

- weekly active users;
- inbox actions per weekly active user;
- percentage of active users reaching inbox zero;
- average number of followed creators;
- Later completion rate.

### Validation targets — hypotheses, not promises

Early beta is encouraging if:

- >= 30% D7 retention among activated users;
- >= 25% of weekly active users reach inbox zero at least twice/week;
- users voluntarily add creators after onboarding rather than only importing and abandoning;
- qualitative feedback explicitly mentions reduced distraction / feeling “done”.

---

# 21. Monetization hypothesis — do not implement first

Potential model:

## Free

- up to 10 creators
- core Inbox
- Later
- minimum duration filter

## Pro

- unlimited creators
- cross-device sync/premium sync features if needed
- creator groups
- priorities
- per-source/per-content-type rules
- daily/weekly digest
- time budget
- future multi-platform integrations

Working price hypothesis:

- EUR 2.99/month
- EUR 24.99/year
- optional EUR 59.99 lifetime

Do not build billing before the core flow demonstrates retention unless a closed beta requires entitlement testing.

---

# 22. Explicit non-goals for MVP

The coding agent must **not** implement these unless this spec is amended:

- native mobile/desktop clients (Kotlin Multiplatform, Compose Multiplatform, Swift, etc.) before validation
- YouTube OAuth subscription import before validation
- OIDC/OAuth login providers before validation
- creator priorities before validation
- Instagram ingestion
- TikTok scraping
- TikTok arbitrary-profile ingestion
- social posting
- comments/likes/follows on upstream services
- creator recommendations
- trending feed
- general content discovery feed
- AI summaries
- semantic ranking
- cross-post deduplication
- automatic cross-platform creator identity matching
- browser extension
- newsletters
- podcast player
- full offline mode
- microservices
- Kafka/RabbitMQ
- Redis unless a measured need appears
- Elasticsearch/OpenSearch
- GraphQL
- custom video hosting
- billing
- elaborate admin panel

---

# 23. Implementation slices

Each slice must leave the repository runnable and tested. The coding agent should implement one slice at a time and avoid mixing future slices into the current PR/branch.

## Slice 0 — Repository foundation

### Goal

Runnable backend + database + minimal client shell.

### Deliverables

- Bun workspace structure (`apps/server`, `apps/web`, `packages/shared`, §14.2)
- Hono server boots on Bun
- PostgreSQL connection (local instance via `docker compose`)
- SQL migration runner (§14.1) with a first no-op/baseline migration
- health endpoint
- web client shell (Vue 3 + Vite + TypeScript) with four navigation destinations
- Vite dev proxy to the backend for `/api`
- config loading for local/dev (env vars, validated with Zod at startup)
- Testcontainers integration-test base, or the documented `docker compose` fallback (§14.1)
- CI build/test command for backend and client (type check, lint if configured, `bun test`, web build)

### Acceptance criteria

- one command starts local backend/database environment;
- migrations run automatically or through one documented command;
- server health endpoint returns 200;
- unit/integration test suite runs from CLI;
- client can call health endpoint.

---

## Slice 1 — YouTube creator resolution + persistence

### Goal

User/developer can add a YouTube creator by handle and persist it.

### Deliverables

- SourceType and core domain entities
- Creator / SourceAccount migrations + repositories
- YouTube API client
- `YouTubeSourceAdapter.resolveAccount`
- resolve API endpoint
- follow/subscription API
- basic Creators screen

### Acceptance criteria

Given `@GoogleDevelopers` or another test handle:

- backend resolves a valid YouTube channel through the official API;
- stores exactly one SourceAccount for the external channel ID;
- stores the uploads playlist ID;
- following twice is idempotent / does not duplicate the subscription;
- invalid handle returns a useful 4xx error;
- source client is covered using deterministic HTTP fixtures/mocks.

---

## Slice 2 — YouTube content sync

### Goal

Followed creators produce normalized ContentItems.

### Deliverables

- ContentItem migration/repository
- `fetchRecentContent`: initial sync via `playlistItems.list`, incremental sync via channel RSS feed, details via `videos.list` (§11.3)
- duration parsing (ISO 8601) into `durationSeconds`
- manual sync endpoint in dev/admin context
- simple scheduled sync job
- source sync logging including Data API quota counters

### Acceptance criteria

- recent uploads are normalized and stored with duration;
- re-running sync creates no duplicates;
- incremental sync of an unchanged feed makes no Data API call;
- old content outside the sync window is not unnecessarily paged forever;
- transient upstream failure does not corrupt `lastSyncedAt`;
- no real YouTube request is required for normal automated tests.

---

## Slice 3 — Finite Inbox vertical slice

### Goal

The product idea works end-to-end.

### Deliverables

- user content state migration/repository
- Inbox query
- Later query
- Done/Later/Dismiss/reset endpoints
- Inbox UI
- Later UI
- empty Inbox / Inbox Zero UI
- Open -> mark Done -> open canonical URL
- optimistic update + Undo

### Acceptance criteria

- a new eligible video appears in Inbox;
- Later removes it from Inbox and shows it in Later;
- Dismiss removes it from Inbox;
- Open removes it and opens the canonical URL;
- Undo can restore the previous state;
- when the last item is handled, the user sees the Inbox Zero state;
- no recommendation content appears anywhere.

**This is the first milestone that demonstrates the actual product.**

---

## Slice 4 — Filtering + creator preferences

### Goal

Reduce unwanted content without adding algorithmic behavior.

### Deliverables

- `user_preferences.min_duration_seconds` migration + preferences endpoints
- filtering in Inbox query: `duration_seconds >= min OR duration_seconds IS NULL`
- settings UI with presets (§6.7)

Creator priority is **not** part of the validation MVP. Ordering is publication date descending only.

### Acceptance criteria

- with the default (180), a 45-second video does not enter the Inbox and a 4-minute video does;
- with `0`, every eligible video enters the Inbox;
- an item with unknown duration is never hidden;
- changing the setting immediately changes eligibility of already-synced items in both directions;
- ordering remains transparent and deterministic.

---

## Slice 5 — Minimal authentication

### Goal

State belongs to a real user, testers are isolated from each other, and the same account works on phone and desktop.

### Deliverables

- magic-link login (§16): email input, single-use token, session cookie
- tester allowlist
- session persistence in PostgreSQL
- email sending via one provider; development mode logs the link
- remove development auth bypass in production mode
- account deletion flow

### Acceptance criteria

- an allowlisted email can log in via link; a non-allowlisted email cannot;
- a login link works once and expires;
- same account in two browsers sees the same subscriptions and content states;
- unauthenticated production API calls fail appropriately;
- deletion removes user-specific data as documented.

---

## Slice 6 — YouTube subscription import — DEFERRED

**Not part of the validation MVP.** Do not implement before validation results exist and this spec is amended. Slice 7 follows directly after Slice 5.

### Goal

Make onboarding fast without destroying curation.

### Deliverables

- YouTube OAuth connect flow
- subscriptions fetch/pagination
- import selection UI
- batch follow operation
- disconnect integration

### Acceptance criteria

- user can connect YouTube;
- Finifeed can list the user's YouTube subscriptions using official API access;
- nothing is imported until selected/confirmed;
- disconnect revokes/deletes stored credential state as far as supported;
- duplicate creators are not created.

---

## Slice 7 — Closed beta polish

### Goal

A product that 20–50 external testers can use.

### Deliverables

- error/empty/loading states
- retry UX
- basic analytics (§20 events)
- privacy/terms text sufficient for a closed beta
- source health visibility for support/debugging
- onboarding polish
- deployment to one host (single backend instance + PostgreSQL + static client)
- a short written tester guide and the end-of-beta feedback question (§5.2)

Only what is needed so that nothing looks broken. No feature work.

### Acceptance criteria

A new tester can open the link, log in, add creators by handle, process their inbox, reach Inbox Zero, close the browser, return later on another device, and see only newly eligible content without developer assistance.

---

# 24. Post-MVP roadmap

Only proceed if core retention/qualitative feedback is promising.

## Phase 2 — Open web sources

Implement:

- RSS/blogs
- podcasts

These strengthen the creator-centric model without depending on closed social APIs.

## Phase 3 — Creator identity

Allow multiple SourceAccounts per Creator and manual linking.

Example:

```text
Creator: Simon Willison
- Blog/RSS
- YouTube
- Mastodon
```

Do **not** start with automatic identity matching. Manual/admin matching is adequate until there is enough data to justify automation.

## Phase 4 — Cross-platform rules

Add user-selectable source/content rules.

## Phase 5 — Instagram spike

Only after confirming the approved API path and review/policy requirements for the exact Finifeed reader use case.

## Phase 6 — TikTok creator opt-in / embeds

Creator claim flow may allow a creator to connect TikTok officially. Public profile embeds may complement this where appropriate.

## Phase 7 — Cross-post deduplication

If the same creator posts the same asset to multiple sources, represent it as one logical Inbox item with multiple source links.

This is valuable but intentionally deferred; it requires identity resolution and content similarity logic.

---

# 25. Testing strategy

## 25.1 Unit tests

Focus on business rules:

- inbox eligibility;
- state transitions;
- filter application;
- subscription backlog boundary;
- deterministic ordering.

Do not write unit tests for trivial getters/data classes.

All automated tests run with `bun test`.

## 25.2 Repository integration tests

Use PostgreSQL/Testcontainers for:

- migrations;
- unique constraints;
- inbox query behavior, including the minimum duration boundary (`>=`) and `NULL` duration;
- pagination;
- concurrent/idempotent upserts.

## 25.3 Source adapter tests

Use captured/synthetic fixtures served through an injected fake `fetch` (§14.5).

Test:

- normal channel resolution;
- not found;
- quota/rate errors;
- malformed/upstream missing fields;
- duplicate content;
- pagination stop behavior;
- RSS feed parsing (normal feed, empty feed, malformed XML, unchanged feed → no Data API call);
- ISO 8601 duration parsing (including hours, missing duration, live streams);
- `videos.list` batching (more than 50 new IDs).

## 25.4 End-to-end happy path

At minimum automate:

```text
create test user
-> resolve/follow fixture creator
-> ingest fixture content
-> GET inbox
-> move one item Later
-> dismiss one
-> open/done one
-> verify Inbox Zero
```

---

# 26. Error behavior

Errors should be understandable and source-aware without leaking upstream internals.

Examples:

- `CREATOR_NOT_FOUND`
- `SOURCE_TEMPORARILY_UNAVAILABLE`
- `SOURCE_RATE_LIMITED`
- `ALREADY_FOLLOWING`
- `CONTENT_NOT_AVAILABLE`
- `INVALID_SOURCE_INPUT`

HTTP mapping can remain conventional.

Store upstream status/error identifiers in logs for diagnostics, not necessarily in client responses.

---

# 27. Coding-agent implementation rules

These instructions are part of the product spec.

1. **Plan the current slice before modifying code.**
2. Implement only the current slice and prerequisites genuinely required by it.
3. Prefer the simplest design that cleanly supports the documented domain model.
4. Do not introduce abstractions for hypothetical future platforms beyond the simple Source Adapter boundary.
5. Do not add microservices, queues, caches, CQRS, event sourcing, generic rules engines, or plugin frameworks without a measured need.
6. Keep domain behavior out of HTTP route handlers.
7. Database changes must be plain SQL migration files applied by the migration runner (§14.1). Never edit an already-applied migration; add a new one.
8. External API calls must be behind testable clients/adapters.
9. No test should require live YouTube/Instagram/TikTok access in normal CI.
10. Add meaningful tests for business logic and persistence behavior; avoid low-value tests.
11. Keep TypeScript concise and idiomatic; `strict` mode, no `any` without a comment explaining why.
12. Follow the module conventions in §14.3; share API types only via `packages/shared`.
13. Do not implement scraping of Instagram or TikTok.
14. Do not invent recommendations, discovery features, or engagement mechanics that are absent from this spec.
15. If a requirement is ambiguous, choose the behavior that best preserves **finite, explicit, user-controlled consumption** and document the decision.
16. After each slice, update this document or an implementation-status section with deviations and decisions.

---

# 28. Definition of done for every slice

A slice is complete only when:

- code compiles;
- automated tests pass;
- lint/static checks pass if configured;
- database migrations are included and tested when needed;
- new external calls have deterministic tests;
- error states are handled;
- no credentials/secrets are committed;
- README/local-run instructions remain correct;
- no unrelated refactor is mixed into the slice;
- acceptance criteria for the slice are demonstrably satisfied.

---

# 29. First coding-agent task

The first implementation request should be narrowly scoped to **Slice 0**.

Suggested prompt:

```text
We are building Finifeed. Treat FINIFEED_PRODUCT_TECH_SPEC.md as the product and architecture source of truth.

Implement Slice 0 — Repository foundation only.

Before coding:
1. Read the complete spec.
2. Produce a short implementation plan for Slice 0.
3. Identify any assumptions that materially affect the repository structure.

Then implement the slice end-to-end. Keep the solution simple and do not implement future slices.

Acceptance criteria are exactly those listed under Slice 0 in the spec. Run the relevant build/tests before finishing and summarize the changes and any deviations from the spec.
```

After Slice 0 is reviewed and accepted, give the agent Slice 1 rather than asking it to implement the entire roadmap at once.

---

# 30. Open product decisions

These questions are intentionally **not blockers for Slice 0–3**.

1. Exact production auth provider after validation (magic link is decided for the closed beta).
2. Exact subscription pricing.
3. Whether and when native mobile/desktop clients are built (only after validation).
4. Whether `Open` should eventually distinguish `OPENED` from `DONE`.
5. Whether a real Shorts classification (beyond the duration filter) is ever needed, e.g. for a visual badge or per-creator rules.
6. Exact Instagram approved integration path.
7. Whether TikTok is supported only for claimed creators, embeds, or an approved partner/API mechanism.
8. Whether creator groups are free or paid.
9. Whether Daily Digest belongs in Pro or core.
10. Whether Finifeed eventually supports non-creator information sources as first-class entities.

Do not block the core vertical slice on these decisions.

---

# 31. The MVP in one diagram

```text
                         FINIFEED
                            |
                  +---------+---------+
                  |                   |
               Client              Backend
          Web app (Vue)       Bun + Hono + Postgres
        Inbox / Later /             |
           Creators                 |
                  |                 |
                  +------ REST -----+
                                    |
                           Source Adapter
                                    |
                     YouTube RSS + Data API
                                    |
                    Creator -> SourceAccount
                                    |
                              ContentItem
                                    |
                    UserSubscription + State
                                    |
                             Finite Inbox
                                    |
                    Open / Later / Dismiss
                                    |
                          YOU'RE ALL CAUGHT UP
```

---

# 32. North star

When product or engineering choices become complicated, return to this question:

> **Does this help the user intentionally catch up with the creators they chose and then be finished?**

If the answer is no, it probably does not belong in the MVP.

