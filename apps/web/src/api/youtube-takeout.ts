import {
  type TakeoutChannel,
  type TakeoutImportResponse,
  TakeoutImportResponseSchema,
  TakeoutPreviewResponseSchema,
} from "@finifeed/shared";
import { apiRequest } from "./client";

/** Parses a Takeout `subscriptions.csv` on the server. Follows nothing. */
export async function previewTakeout(csv: string): Promise<TakeoutChannel[]> {
  return (
    await apiRequest("/integrations/youtube/takeout/preview", TakeoutPreviewResponseSchema, {
      method: "POST",
      body: { csv },
    })
  ).channels;
}

export function importTakeoutChannels(channelIds: string[]): Promise<TakeoutImportResponse> {
  return apiRequest("/integrations/youtube/takeout/import", TakeoutImportResponseSchema, {
    method: "POST",
    body: { channelIds },
  });
}
