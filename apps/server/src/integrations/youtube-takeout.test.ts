import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  CreatorCandidateSchema,
  ErrorResponseSchema,
  FollowedCreatorSchema,
  FollowedCreatorsResponseSchema,
  TakeoutImportResponseSchema,
  TakeoutPreviewResponseSchema,
} from "@finifeed/shared";
import { sql } from "kysely";
import { createApp } from "../app";
import { ensureDevUser } from "../auth/dev-user";
import { migrate } from "../database/migrate";
import { createYouTubeClient } from "../sources/youtube/youtube-client";
import { createYouTubeSourceAdapter } from "../sources/youtube/youtube-source-adapter";
import { channelFixture, channelListResponse, fakeFetch } from "../testing/fake-youtube";
import { createTestDatabase, silentLogger, type TestDatabase } from "../testing/test-database";

const FIRESHIP = channelFixture({ id: "UCsBjURrPoezykLs9EqgamOA", title: "Fireship", handle: "@fireship" });
const GOOGLE_DEVELOPERS = channelFixture();
const DELETED_CHANNEL_ID = "UCdeleteddeleteddeleted0";

const TAKEOUT_CSV = [
  "Channel Id,Channel Url,Channel Title",
  `${GOOGLE_DEVELOPERS.id},http://www.youtube.com/channel/${GOOGLE_DEVELOPERS.id},Google Developers`,
  `${FIRESHIP.id},http://www.youtube.com/channel/${FIRESHIP.id},Fireship`,
  `${DELETED_CHANNEL_ID},http://www.youtube.com/channel/${DELETED_CHANNEL_ID},"Gone, sadly"`,
  "",
].join("\n");

let database: TestDatabase;
let userId: string;

/** Answers `channels.list` by `id` (comma-separated) or `forHandle` from the fixtures above. */
const youtubeFetch = fakeFetch((url) => {
  const ids = url.searchParams.get("id")?.split(",") ?? [];
  const handle = url.searchParams.get("forHandle")?.toLowerCase();
  return channelListResponse(
    ...[FIRESHIP, GOOGLE_DEVELOPERS].filter((c) => ids.includes(c.id) || c.snippet.customUrl === handle),
  );
});

function app(asUserId = userId) {
  const youtube = createYouTubeSourceAdapter(
    createYouTubeClient({ apiKey: "test-key", logger: silentLogger, fetch: youtubeFetch }),
  );
  return createApp({ db: database.db, logger: silentLogger, sourceAdapters: { YOUTUBE: youtube }, devUserId: asUserId });
}

function post(path: string, body: unknown, asUserId?: string) {
  return app(asUserId).request(`/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function preview(csv = TAKEOUT_CSV, asUserId?: string) {
  const response = await post("/integrations/youtube/takeout/preview", { csv }, asUserId);
  expect(response.status).toBe(200);
  return TakeoutPreviewResponseSchema.parse(await response.json()).channels;
}

async function importChannels(channelIds: string[], asUserId?: string) {
  const response = await post("/integrations/youtube/takeout/import", { channelIds }, asUserId);
  expect(response.status).toBe(200);
  return TakeoutImportResponseSchema.parse(await response.json());
}

async function followByHandle(handle: string) {
  const candidate = CreatorCandidateSchema.parse(
    await (await post("/creators/resolve", { sourceType: "YOUTUBE", input: handle })).json(),
  );
  return FollowedCreatorSchema.parse(await (await post("/subscriptions", { creatorId: candidate.creatorId })).json());
}

async function listCreators(asUserId?: string) {
  const response = await app(asUserId).request("/api/v1/creators");
  return FollowedCreatorsResponseSchema.parse(await response.json()).creators;
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe(code as never);
}

beforeAll(async () => {
  database = await createTestDatabase();
  await migrate(database.sql, silentLogger);
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  await sql`truncate users, creators, source_accounts, user_subscriptions cascade`.execute(database.db);
  userId = await ensureDevUser(database.db);
  youtubeFetch.calls.length = 0;
});

describe("POST /api/v1/integrations/youtube/takeout/preview", () => {
  test("lists the export's channels alphabetically without storing anything or calling YouTube", async () => {
    expect(await preview()).toEqual([
      {
        channelId: FIRESHIP.id,
        title: "Fireship",
        canonicalUrl: `https://www.youtube.com/channel/${FIRESHIP.id}`,
        subscriptionId: null,
      },
      {
        channelId: DELETED_CHANNEL_ID,
        title: "Gone, sadly",
        canonicalUrl: `https://www.youtube.com/channel/${DELETED_CHANNEL_ID}`,
        subscriptionId: null,
      },
      {
        channelId: GOOGLE_DEVELOPERS.id,
        title: "Google Developers",
        canonicalUrl: `https://www.youtube.com/channel/${GOOGLE_DEVELOPERS.id}`,
        subscriptionId: null,
      },
    ]);
    expect(youtubeFetch.calls).toHaveLength(0);
    expect(await database.db.selectFrom("creators").selectAll().execute()).toHaveLength(0);
  });

  test("marks channels the user already follows, but not those other users follow", async () => {
    const followed = await followByHandle("@fireship");
    const other = await database.db.insertInto("users").values({ email: "other@example.com" }).returning("id").executeTakeFirstOrThrow();

    const mine = await preview();
    const theirs = await preview(TAKEOUT_CSV, other.id);

    expect(mine.find((c) => c.channelId === FIRESHIP.id)?.subscriptionId).toBe(followed.subscriptionId);
    expect(theirs.every((c) => c.subscriptionId === null)).toBe(true);
  });

  test("a file without channels is a 400 INVALID_SOURCE_INPUT", async () => {
    const response = await post("/integrations/youtube/takeout/preview", { csv: "name,email\nJoe,joe@example.com" });

    await expectError(response, 400, "INVALID_SOURCE_INPUT");
  });

  test("an empty file is a 400 VALIDATION_FAILED", async () => {
    await expectError(await post("/integrations/youtube/takeout/preview", { csv: "" }), 400, "VALIDATION_FAILED");
  });
});

describe("POST /api/v1/integrations/youtube/takeout/import", () => {
  test("follows the selected channels with details from YouTube in a single API call", async () => {
    const result = await importChannels([FIRESHIP.id, GOOGLE_DEVELOPERS.id, FIRESHIP.id]);

    expect(result.followed.map((c) => c.displayName)).toEqual(["Fireship", "Google for Developers"]);
    expect(result).toMatchObject({ alreadyFollowingCount: 0, notFoundChannelIds: [] });
    expect(await listCreators()).toEqual(result.followed);
    expect(youtubeFetch.calls).toHaveLength(1);
    expect(youtubeFetch.calls[0]?.searchParams.get("id")).toBe(`${FIRESHIP.id},${GOOGLE_DEVELOPERS.id}`);
  });

  test("reports channels YouTube doesn't know", async () => {
    const result = await importChannels([FIRESHIP.id, DELETED_CHANNEL_ID]);

    expect(result.followed.map((c) => c.displayName)).toEqual(["Fireship"]);
    expect(result.notFoundChannelIds).toEqual([DELETED_CHANNEL_ID]);
  });

  test("is idempotent and reuses creators that already exist", async () => {
    const existing = await followByHandle("@fireship");

    const first = await importChannels([FIRESHIP.id, GOOGLE_DEVELOPERS.id]);
    const again = await importChannels([FIRESHIP.id, GOOGLE_DEVELOPERS.id]);

    expect(first.followed.map((c) => c.displayName)).toEqual(["Google for Developers"]);
    expect(first.alreadyFollowingCount).toBe(1);
    expect(again).toEqual({ followed: [], alreadyFollowingCount: 2, notFoundChannelIds: [] });
    expect((await listCreators()).find((c) => c.creatorId === existing.creatorId)?.subscriptionId).toBe(
      existing.subscriptionId,
    );
    const counts = await sql<{ creators: number; subscriptions: number }>`
      select (select count(*)::int from creators) as creators, (select count(*)::int from user_subscriptions) as subscriptions
    `.execute(database.db);
    expect(counts.rows[0]).toEqual({ creators: 2, subscriptions: 2 });
  });

  test("re-follows an unfollowed creator with a fresh backlog window", async () => {
    const { subscriptionId } = await followByHandle("@fireship");
    await app().request(`/api/v1/subscriptions/${subscriptionId}`, { method: "DELETE" });
    await sql`update user_subscriptions set inbox_from = now() - interval '30 days'`.execute(database.db);

    const result = await importChannels([FIRESHIP.id]);

    expect(result.followed.map((c) => c.subscriptionId)).toEqual([subscriptionId]);
    const { rows } = await sql<{ backlog: string }>`
      select (followed_at - inbox_from)::text as backlog from user_subscriptions
    `.execute(database.db);
    expect(rows[0]?.backlog).toBe("7 days");
  });

  test.each([
    ["no channels", { channelIds: [] }],
    ["an invalid channel ID", { channelIds: ["@fireship"] }],
    ["too many channels", { channelIds: Array.from({ length: 101 }, () => FIRESHIP.id) }],
  ])("%s is a 400 VALIDATION_FAILED", async (_, body) => {
    await expectError(await post("/integrations/youtube/takeout/import", body), 400, "VALIDATION_FAILED");
    expect(youtubeFetch.calls).toHaveLength(0);
  });
});
