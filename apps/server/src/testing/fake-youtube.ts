import type { FetchFn } from "../sources/youtube/youtube-client";

/** A `channels.list` item shaped like the real API response, trimmed to the parts Finifeed reads. */
export function channelFixture(overrides: { id?: string; title?: string; handle?: string | null; uploads?: string } = {}) {
  const id = overrides.id ?? "UC_x5XG1OV2P6uZZ5FSM9Ttw";
  const handle = overrides.handle === undefined ? "@googledevelopers" : overrides.handle;
  return {
    kind: "youtube#channel",
    etag: "fixture-etag",
    id,
    snippet: {
      title: overrides.title ?? "Google for Developers",
      description: "Fixture channel",
      ...(handle ? { customUrl: handle } : {}),
      publishedAt: "2007-08-23T00:34:43Z",
      thumbnails: {
        default: { url: `https://yt3.ggpht.com/${id}=s88`, width: 88, height: 88 },
        medium: { url: `https://yt3.ggpht.com/${id}=s240`, width: 240, height: 240 },
        high: { url: `https://yt3.ggpht.com/${id}=s800`, width: 800, height: 800 },
      },
    },
    contentDetails: {
      relatedPlaylists: { likes: "", uploads: overrides.uploads ?? `UU${id.slice(2)}` },
    },
  };
}

export function channelListResponse(...items: unknown[]) {
  return Response.json({
    kind: "youtube#channelListResponse",
    etag: "fixture-etag",
    pageInfo: { totalResults: items.length, resultsPerPage: 5 },
    ...(items.length > 0 ? { items } : {}),
  });
}

export function youtubeErrorResponse(status: number, reason: string) {
  return Response.json(
    { error: { code: status, message: reason, errors: [{ message: reason, domain: "youtube", reason }] } },
    { status },
  );
}

/** Fake `fetch` that answers from a handler and records every requested URL. */
export function fakeFetch(handler: (url: URL) => Response | Promise<Response>): FetchFn & { calls: URL[] } {
  const calls: URL[] = [];
  const fn = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url);
    return handler(url);
  };
  return Object.assign(fn, { calls });
}
