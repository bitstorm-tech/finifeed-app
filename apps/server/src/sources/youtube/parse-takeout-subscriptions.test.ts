import { describe, expect, test } from "bun:test";
import { parseTakeoutSubscriptions } from "./parse-takeout-subscriptions";

const GOOGLE_DEVELOPERS = "UC_x5XG1OV2P6uZZ5FSM9Ttw";
const FIRESHIP = "UCsBjURrPoezykLs9EqgamOA";

describe("parseTakeoutSubscriptions", () => {
  test("reads an English Takeout export", () => {
    const csv = [
      "Channel Id,Channel Url,Channel Title",
      `${GOOGLE_DEVELOPERS},http://www.youtube.com/channel/${GOOGLE_DEVELOPERS},Google for Developers`,
      `${FIRESHIP},http://www.youtube.com/channel/${FIRESHIP},Fireship`,
      "",
    ].join("\n");

    expect(parseTakeoutSubscriptions(csv)).toEqual([
      { channelId: GOOGLE_DEVELOPERS, title: "Google for Developers" },
      { channelId: FIRESHIP, title: "Fireship" },
    ]);
  });

  test("ignores localized headers, a BOM and CRLF line breaks", () => {
    const csv = `﻿Kanal-ID,Kanal-URL,Kanaltitel\r\n${FIRESHIP},http://www.youtube.com/channel/${FIRESHIP},Fireship\r\n`;

    expect(parseTakeoutSubscriptions(csv)).toEqual([{ channelId: FIRESHIP, title: "Fireship" }]);
  });

  test("handles quoted titles with commas, quotes and line breaks", () => {
    const csv = [
      "Channel Id,Channel Url,Channel Title",
      `${FIRESHIP},http://www.youtube.com/channel/${FIRESHIP},"Code, ""Fire"" &\nShip"`,
    ].join("\n");

    expect(parseTakeoutSubscriptions(csv)).toEqual([{ channelId: FIRESHIP, title: 'Code, "Fire" &\nShip' }]);
  });

  test("finds the channel ID in the URL when the ID column is missing", () => {
    const csv = `Channel Url,Channel Title\nhttps://www.youtube.com/channel/${FIRESHIP},Fireship`;

    expect(parseTakeoutSubscriptions(csv)).toEqual([{ channelId: FIRESHIP, title: "Fireship" }]);
  });

  test("keeps each channel once and falls back to the ID without a title", () => {
    const csv = `${FIRESHIP},,Fireship\n${FIRESHIP},,Fireship again\n${GOOGLE_DEVELOPERS},,`;

    expect(parseTakeoutSubscriptions(csv)).toEqual([
      { channelId: FIRESHIP, title: "Fireship" },
      { channelId: GOOGLE_DEVELOPERS, title: GOOGLE_DEVELOPERS },
    ]);
  });

  test.each([
    ["an empty file", ""],
    ["only a header", "Channel Id,Channel Url,Channel Title\n"],
    ["a different CSV", "name,email\nJoe,joe@example.com"],
  ])("rejects %s", (_, csv) => {
    expect(() => parseTakeoutSubscriptions(csv)).toThrow(/contains no YouTube channels/);
  });
});
