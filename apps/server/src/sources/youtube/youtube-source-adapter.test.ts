import { describe, expect, test } from "bun:test";
import {
  channelFixture,
  channelListResponse,
  fakeFetch,
  youtubeErrorResponse,
} from "../../testing/fake-youtube";
import { silentLogger } from "../../testing/test-database";
import { type FetchFn, createYouTubeClient } from "./youtube-client";
import { createYouTubeSourceAdapter } from "./youtube-source-adapter";

function adapterWith(fetch: FetchFn, { apiKey }: { apiKey?: string } = { apiKey: "test-key" }) {
  return createYouTubeSourceAdapter(createYouTubeClient({ apiKey, logger: silentLogger, fetch }));
}

describe("YouTube resolveAccount", () => {
  test("resolves a handle through channels.list and normalizes the channel", async () => {
    const fetch = fakeFetch(() => channelListResponse(channelFixture()));

    const account = await adapterWith(fetch).resolveAccount("@GoogleDevelopers");

    expect(account).toEqual({
      sourceType: "YOUTUBE",
      externalId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      handle: "@googledevelopers",
      displayName: "Google for Developers",
      canonicalUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
      avatarUrl: "https://yt3.ggpht.com/UC_x5XG1OV2P6uZZ5FSM9Ttw=s240",
      metadata: { uploadsPlaylistId: "UU_x5XG1OV2P6uZZ5FSM9Ttw" },
    });

    expect(fetch.calls).toHaveLength(1);
    const url = fetch.calls[0] ?? new URL("about:blank");
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/channels");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      part: "snippet,contentDetails",
      forHandle: "@GoogleDevelopers",
      key: "test-key",
    });
  });

  test.each([
    ["https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", "id", "UC_x5XG1OV2P6uZZ5FSM9Ttw"],
    ["https://www.youtube.com/user/GoogleDevelopers", "forUsername", "GoogleDevelopers"],
  ])("looks up %p by %p", async (input, param, value) => {
    const fetch = fakeFetch(() => channelListResponse(channelFixture()));

    await adapterWith(fetch).resolveAccount(input);

    expect(fetch.calls[0]?.searchParams.get(param)).toBe(value);
  });

  test("channels without a handle have a null handle", async () => {
    const fetch = fakeFetch(() => channelListResponse(channelFixture({ handle: null })));

    expect((await adapterWith(fetch).resolveAccount("@whatever")).handle).toBeNull();
  });

  test("invalid input fails without calling the API", async () => {
    const fetch = fakeFetch(() => channelListResponse(channelFixture()));

    await expect(adapterWith(fetch).resolveAccount("https://vimeo.com/foo")).rejects.toMatchObject({
      code: "INVALID_SOURCE_INPUT",
    });
    expect(fetch.calls).toHaveLength(0);
  });

  test("an unknown handle is CREATOR_NOT_FOUND", async () => {
    const fetch = fakeFetch(() => channelListResponse());

    await expect(adapterWith(fetch).resolveAccount("@doesnotexist123")).rejects.toMatchObject({
      code: "CREATOR_NOT_FOUND",
      message: 'No YouTube channel found for "@doesnotexist123".',
    });
  });

  test.each([
    [403, "quotaExceeded"],
    [403, "rateLimitExceeded"],
    [429, "tooManyRequests"],
  ])("HTTP %p %p is SOURCE_RATE_LIMITED", async (status, reason) => {
    const fetch = fakeFetch(() => youtubeErrorResponse(status, reason));

    await expect(adapterWith(fetch).resolveAccount("@Fireship")).rejects.toMatchObject({
      code: "SOURCE_RATE_LIMITED",
    });
  });

  test.each([
    ["a server error", () => youtubeErrorResponse(503, "backendError")],
    ["an invalid API key", () => youtubeErrorResponse(400, "keyInvalid")],
    ["a non-JSON error page", () => new Response("<html>Bad Gateway</html>", { status: 502 })],
    ["a malformed response", () => Response.json({ items: [{ id: "UC123", snippet: {} }] })],
    [
      "a network failure",
      () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("%s is SOURCE_TEMPORARILY_UNAVAILABLE", async (_, respond) => {
    const fetch = fakeFetch(respond);

    await expect(adapterWith(fetch).resolveAccount("@Fireship")).rejects.toMatchObject({
      code: "SOURCE_TEMPORARILY_UNAVAILABLE",
    });
  });

  test("without an API key nothing is requested", async () => {
    const fetch = fakeFetch(() => channelListResponse(channelFixture()));

    await expect(adapterWith(fetch, {}).resolveAccount("@Fireship")).rejects.toMatchObject({
      code: "SOURCE_TEMPORARILY_UNAVAILABLE",
    });
    expect(fetch.calls).toHaveLength(0);
  });
});
