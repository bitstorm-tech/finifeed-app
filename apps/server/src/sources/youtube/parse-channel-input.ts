import { ErrorCode } from "@finifeed/shared";
import { AppError } from "../../errors/app-error";

/** How a channel is looked up via `channels.list`. */
export type ChannelLookup =
  | { by: "handle"; handle: string }
  | { by: "id"; channelId: string }
  | { by: "username"; username: string };

const CHANNEL_ID = /^UC[\w-]{22}$/;
/** YouTube handles: 3–30 letters, digits, `_`, `-`, `.` (letters may be non-Latin). */
const HANDLE = /^[\p{L}\p{M}\p{N}._-]{3,30}$/u;
const LEGACY_USERNAME = /^[\w-]{1,100}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

const HINT = "Enter a YouTube @handle or channel URL, e.g. @Fireship or https://www.youtube.com/@Fireship.";

function invalid(message: string): never {
  throw new AppError(ErrorCode.INVALID_SOURCE_INPUT, message);
}

/**
 * Parses user input into a channel lookup (spec §11.2). Accepts `@handle`, a bare handle, a channel ID,
 * and `youtube.com/@handle`, `/channel/UC…` or legacy `/user/name` URLs, with or without scheme.
 */
export function parseChannelInput(raw: string): ChannelLookup {
  const input = raw.trim();

  if (input.startsWith("@")) {
    const handle = input.slice(1);
    return HANDLE.test(handle) ? { by: "handle", handle } : invalid(`"${input}" is not a valid YouTube handle.`);
  }
  if (CHANNEL_ID.test(input)) return { by: "id", channelId: input };
  if (HANDLE.test(input) && !input.includes(".")) return { by: "handle", handle: input };

  return parseChannelUrl(input);
}

function parseChannelUrl(input: string): ChannelLookup {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    invalid(HINT);
  }

  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") invalid("This is a video link. Please paste the channel's URL or @handle instead.");
  if (!YOUTUBE_HOSTS.has(host)) invalid(HINT);

  const [first = "", second = ""] = url.pathname.split("/").filter(Boolean).map(safeDecode);

  if (first.startsWith("@")) return parseChannelInput(first);
  if (first === "channel" && CHANNEL_ID.test(second)) return { by: "id", channelId: second };
  if (first === "user" && LEGACY_USERNAME.test(second)) return { by: "username", username: second };
  if (first === "c") invalid("Custom /c/ URLs can't be looked up. Please use the channel's @handle instead.");
  if (first === "watch" || first === "shorts" || first === "live") {
    invalid("This is a video link. Please paste the channel's URL or @handle instead.");
  }
  return invalid(HINT);
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
