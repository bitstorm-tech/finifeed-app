import { ErrorCode } from "@finifeed/shared";
import { AppError } from "../../errors/app-error";
import type { ContentSourceAdapter } from "../content-source-adapter";
import { parseChannelInput } from "./parse-channel-input";
import type { YouTubeChannel, YouTubeClient } from "./youtube-client";

/** Stored in `source_accounts.source_metadata` for YouTube accounts. */
export interface YouTubeSourceMetadata {
  uploadsPlaylistId: string;
}

export function createYouTubeSourceAdapter(client: YouTubeClient): ContentSourceAdapter {
  return {
    sourceType: "YOUTUBE",

    async resolveAccount(input) {
      const channel = await client.findChannel(parseChannelInput(input));
      if (!channel) {
        throw new AppError(ErrorCode.CREATOR_NOT_FOUND, `No YouTube channel found for "${input.trim()}".`);
      }

      const metadata: YouTubeSourceMetadata = { uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads };
      const customUrl = channel.snippet.customUrl;
      return {
        sourceType: "YOUTUBE",
        externalId: channel.id,
        handle: customUrl?.startsWith("@") ? customUrl : null,
        displayName: channel.snippet.title,
        canonicalUrl: `https://www.youtube.com/channel/${channel.id}`,
        avatarUrl: pickAvatar(channel),
        metadata: { ...metadata },
      };
    },
  };
}

function pickAvatar(channel: YouTubeChannel): string | null {
  const thumbnails = channel.snippet.thumbnails ?? {};
  return (thumbnails.medium ?? thumbnails.high ?? thumbnails.default)?.url ?? null;
}
