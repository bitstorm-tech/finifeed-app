import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  CreatorCandidateSchema,
  ErrorResponseSchema,
  FollowedCreatorSchema,
  FollowedCreatorsResponseSchema,
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

let database: TestDatabase;
let userId: string;

/** Answers `channels.list` by handle from the fixtures above; unknown handles return no items. */
const youtubeFetch = fakeFetch((url) => {
  const handle = url.searchParams.get("forHandle")?.toLowerCase();
  const channel = [FIRESHIP, GOOGLE_DEVELOPERS].find((c) => c.snippet.customUrl === handle);
  return channel ? channelListResponse(channel) : channelListResponse();
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

async function resolve(input: string, asUserId?: string) {
  const response = await post("/creators/resolve", { sourceType: "YOUTUBE", input }, asUserId);
  expect(response.status).toBe(200);
  return CreatorCandidateSchema.parse(await response.json());
}

async function follow(creatorId: string, asUserId?: string) {
  return post("/subscriptions", { creatorId }, asUserId);
}

async function listCreators(asUserId?: string) {
  const response = await app(asUserId).request("/api/v1/creators");
  expect(response.status).toBe(200);
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

describe("POST /api/v1/creators/resolve", () => {
  test("resolves a handle, stores the creator and source account, but does not follow", async () => {
    const candidate = await resolve("@GoogleDevelopers");

    expect(candidate).toMatchObject({
      displayName: "Google for Developers",
      avatarUrl: "https://yt3.ggpht.com/UC_x5XG1OV2P6uZZ5FSM9Ttw=s240",
      source: {
        sourceType: "YOUTUBE",
        handle: "@googledevelopers",
        canonicalUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
      },
      subscriptionId: null,
    });

    const accounts = await database.db.selectFrom("source_accounts").selectAll().execute();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: candidate.source.id,
      creator_id: candidate.creatorId,
      external_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      source_metadata: { uploadsPlaylistId: "UU_x5XG1OV2P6uZZ5FSM9Ttw" },
      sync_status: "PENDING",
      last_synced_at: null,
    });
    expect(await listCreators()).toEqual([]);
  });

  test("resolving the same channel again stores exactly one source account and creator", async () => {
    const first = await resolve("@GoogleDevelopers");
    const second = await resolve("https://www.youtube.com/@googledevelopers");
    const [third] = await Promise.all([resolve("@GoogleDevelopers"), resolve("@GoogleDevelopers")]);

    expect(second.creatorId).toBe(first.creatorId);
    expect(third?.source.id).toBe(first.source.id);
    const counts = await sql<{ creators: number; accounts: number }>`
      select (select count(*)::int from creators) as creators, (select count(*)::int from source_accounts) as accounts
    `.execute(database.db);
    expect(counts.rows[0]).toEqual({ creators: 1, accounts: 1 });
  });

  test("re-resolving refreshes the stored channel details", async () => {
    await resolve("@fireship");
    const renamed = channelFixture({ id: FIRESHIP.id, title: "Fireship 2", handle: "@fireship" });
    const fetch = fakeFetch(() => channelListResponse(renamed));
    const youtube = createYouTubeSourceAdapter(createYouTubeClient({ apiKey: "k", logger: silentLogger, fetch }));
    const renamingApp = createApp({ db: database.db, logger: silentLogger, sourceAdapters: { YOUTUBE: youtube }, devUserId: userId });

    const response = await renamingApp.request("/api/v1/creators/resolve", {
      method: "POST",
      body: JSON.stringify({ sourceType: "YOUTUBE", input: "@fireship" }),
    });

    expect(response.status).toBe(200);
    const creator = await database.db.selectFrom("creators").select("display_name").executeTakeFirstOrThrow();
    expect(creator.display_name).toBe("Fireship 2");
  });

  test("reports an existing subscription", async () => {
    const { creatorId } = await resolve("@fireship");
    const followed = FollowedCreatorSchema.parse(await (await follow(creatorId)).json());

    expect((await resolve("@fireship")).subscriptionId).toBe(followed.subscriptionId);
  });

  test("an unknown handle is a 404 CREATOR_NOT_FOUND", async () => {
    await expectError(await post("/creators/resolve", { sourceType: "YOUTUBE", input: "@nobody_here" }), 404, "CREATOR_NOT_FOUND");
    expect(await database.db.selectFrom("creators").selectAll().execute()).toHaveLength(0);
  });

  test("unparseable input is a 400 INVALID_SOURCE_INPUT without calling YouTube", async () => {
    const response = await post("/creators/resolve", { sourceType: "YOUTUBE", input: "https://youtu.be/dQw4w9WgXcQ" });

    await expectError(response, 400, "INVALID_SOURCE_INPUT");
    expect(youtubeFetch.calls).toHaveLength(0);
  });

  test.each([
    ["an unsupported source type", { sourceType: "TIKTOK", input: "@someone" }],
    ["empty input", { sourceType: "YOUTUBE", input: "   " }],
    ["a missing body field", { sourceType: "YOUTUBE" }],
  ])("%s is a 400 VALIDATION_FAILED", async (_, body) => {
    await expectError(await post("/creators/resolve", body), 400, "VALIDATION_FAILED");
  });

  test("invalid JSON is a 400 VALIDATION_FAILED", async () => {
    const response = await app().request("/api/v1/creators/resolve", { method: "POST", body: "{nope" });

    await expectError(response, 400, "VALIDATION_FAILED");
  });
});

describe("subscriptions", () => {
  test("following returns 201 and the creator appears in the list", async () => {
    const { creatorId, source } = await resolve("@fireship");

    const response = await follow(creatorId);

    expect(response.status).toBe(201);
    const followed = FollowedCreatorSchema.parse(await response.json());
    expect(followed).toMatchObject({
      creatorId,
      displayName: "Fireship",
      sources: [{ id: source.id, sourceType: "YOUTUBE", handle: "@fireship", displayName: "Fireship" }],
    });
    expect(await listCreators()).toEqual([followed]);
  });

  test("a new subscription's inbox starts seven days back", async () => {
    const { creatorId } = await resolve("@fireship");
    await follow(creatorId);

    const { rows } = await sql<{ backlog: string }>`
      select (followed_at - inbox_from)::text as backlog from user_subscriptions
    `.execute(database.db);
    expect(rows[0]?.backlog).toBe("7 days");
  });

  test("following twice is idempotent", async () => {
    const { creatorId } = await resolve("@fireship");
    const first = FollowedCreatorSchema.parse(await (await follow(creatorId)).json());

    const again = await follow(creatorId);

    expect(again.status).toBe(200);
    expect(FollowedCreatorSchema.parse(await again.json())).toEqual(first);
    expect(await database.db.selectFrom("user_subscriptions").selectAll().execute()).toHaveLength(1);
  });

  test("following an unknown creator is a 404", async () => {
    await expectError(await follow(crypto.randomUUID()), 404, "CREATOR_NOT_FOUND");
  });

  test("unfollowing removes the creator from the list; following again reactivates the same subscription", async () => {
    const { creatorId } = await resolve("@fireship");
    const { subscriptionId } = FollowedCreatorSchema.parse(await (await follow(creatorId)).json());

    const deleted = await app().request(`/api/v1/subscriptions/${subscriptionId}`, { method: "DELETE" });

    expect(deleted.status).toBe(204);
    expect(await listCreators()).toEqual([]);
    expect((await resolve("@fireship")).subscriptionId).toBeNull();

    const refollowed = await follow(creatorId);
    expect(refollowed.status).toBe(201);
    expect(FollowedCreatorSchema.parse(await refollowed.json()).subscriptionId).toBe(subscriptionId);
  });

  test.each(["unknown", "already unfollowed", "not a UUID"])("unfollowing an %s subscription is a 404", async (kind) => {
    const { creatorId } = await resolve("@fireship");
    const { subscriptionId } = FollowedCreatorSchema.parse(await (await follow(creatorId)).json());
    const target = { unknown: crypto.randomUUID(), "already unfollowed": subscriptionId, "not a UUID": "abc" }[kind];
    if (kind === "already unfollowed") await app().request(`/api/v1/subscriptions/${subscriptionId}`, { method: "DELETE" });

    await expectError(await app().request(`/api/v1/subscriptions/${target}`, { method: "DELETE" }), 404, "NOT_FOUND");
  });

  test("creators are listed alphabetically, case-insensitively", async () => {
    for (const input of ["@fireship", "@googledevelopers"]) await follow((await resolve(input)).creatorId);
    const lowercase = channelFixture({ id: "UCaaaaaaaaaaaaaaaaaaaaaa", title: "arte", handle: "@arte" });
    const { id } = await database.db
      .insertInto("creators")
      .values({ display_name: lowercase.snippet.title, avatar_url: null })
      .returning("id")
      .executeTakeFirstOrThrow();
    await follow(id);

    expect((await listCreators()).map((c) => c.displayName)).toEqual(["arte", "Fireship", "Google for Developers"]);
  });

  test("users only see and manage their own subscriptions", async () => {
    const { creatorId } = await resolve("@fireship");
    const { subscriptionId } = FollowedCreatorSchema.parse(await (await follow(creatorId)).json());
    const other = await database.db
      .insertInto("users")
      .values({ email: "other@example.com" })
      .returning("id")
      .executeTakeFirstOrThrow();

    expect(await listCreators(other.id)).toEqual([]);
    expect((await resolve("@fireship", other.id)).subscriptionId).toBeNull();
    const response = await app(other.id).request(`/api/v1/subscriptions/${subscriptionId}`, { method: "DELETE" });
    await expectError(response, 404, "NOT_FOUND");
    expect(await listCreators()).toHaveLength(1);
  });
});
