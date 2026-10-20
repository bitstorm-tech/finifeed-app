import { ErrorCode, YOUTUBE_CHANNEL_ID_PATTERN } from "@finifeed/shared";
import { AppError } from "../../errors/app-error";

export interface TakeoutSubscription {
  channelId: string;
  title: string;
}

const CHANNEL_URL = /\/channel\/(UC[\w-]{22})(?:[/?#]|$)/;

/**
 * Reads the `subscriptions.csv` of a Google Takeout YouTube export (columns: channel ID, channel URL, title).
 * Takeout localizes the header row and the file name, so columns are recognized by their content instead.
 * Rows without a channel ID (the header, blank lines) are skipped; duplicate channels are kept once.
 */
export function parseTakeoutSubscriptions(csv: string): TakeoutSubscription[] {
  const subscriptions = new Map<string, TakeoutSubscription>();

  for (const row of parseCsv(csv.replace(/^﻿/, ""))) {
    const cells = row.map((cell) => cell.trim());
    const channelId = cells.find((cell) => YOUTUBE_CHANNEL_ID_PATTERN.test(cell)) ?? cells.map(channelIdFromUrl).find(Boolean);
    if (!channelId || subscriptions.has(channelId)) continue;

    const title = cells.find((cell) => cell && cell !== channelId && !/^https?:\/\//i.test(cell)) ?? channelId;
    subscriptions.set(channelId, { channelId, title });
  }

  if (subscriptions.size === 0) {
    throw new AppError(
      ErrorCode.INVALID_SOURCE_INPUT,
      "This file contains no YouTube channels. Please choose the subscriptions CSV from your Google Takeout export.",
    );
  }
  return [...subscriptions.values()];
}

function channelIdFromUrl(cell: string): string | undefined {
  return CHANNEL_URL.exec(cell)?.[1];
}

/** RFC 4180: comma-separated, fields optionally quoted, `""` escapes a quote, CRLF or LF line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length > 0) rows.push([...row, field]);
  return rows;
}
