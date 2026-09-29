import { describe, expect, test } from "bun:test";
import { parseChannelInput } from "./parse-channel-input";

const CHANNEL_ID = "UC_x5XG1OV2P6uZZ5FSM9Ttw";

describe("parseChannelInput", () => {
  test.each([
    ["@Fireship", "Fireship"],
    ["  @Fireship  ", "Fireship"],
    ["Fireship", "Fireship"],
    ["@mr.beast_6000-x", "mr.beast_6000-x"],
    ["@ÄrzteKanal", "ÄrzteKanal"],
    ["https://www.youtube.com/@Fireship", "Fireship"],
    ["https://youtube.com/@Fireship/videos", "Fireship"],
    ["http://m.youtube.com/@Fireship?si=abc", "Fireship"],
    ["www.youtube.com/@Fireship", "Fireship"],
    ["youtube.com/@Fireship", "Fireship"],
    ["https://www.youtube.com/@%C3%84rzteKanal", "ÄrzteKanal"],
  ])("%p is handle %p", (input, handle) => {
    expect(parseChannelInput(input)).toEqual({ by: "handle", handle });
  });

  test.each([CHANNEL_ID, `https://www.youtube.com/channel/${CHANNEL_ID}`, `youtube.com/channel/${CHANNEL_ID}/featured`])(
    "%p is a channel ID",
    (input) => {
      expect(parseChannelInput(input)).toEqual({ by: "id", channelId: CHANNEL_ID });
    },
  );

  test("legacy /user/ URLs look up by username", () => {
    expect(parseChannelInput("https://www.youtube.com/user/GoogleDevelopers")).toEqual({
      by: "username",
      username: "GoogleDevelopers",
    });
  });

  test.each([
    ["", /handle or channel URL/],
    ["@", /not a valid YouTube handle/],
    ["@ab", /not a valid YouTube handle/],
    ["@has space", /not a valid YouTube handle/],
    ["@way_too_long_for_a_youtube_handle", /not a valid YouTube handle/],
    ["https://vimeo.com/@Fireship", /handle or channel URL/],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", /video link/],
    ["https://youtu.be/dQw4w9WgXcQ", /video link/],
    ["https://www.youtube.com/c/Fireship", /Custom \/c\/ URLs/],
    ["https://www.youtube.com/channel/not-an-id", /handle or channel URL/],
    ["https://www.youtube.com/", /handle or channel URL/],
    ["not a handle at all", /handle or channel URL/],
  ])("rejects %p", (input, message) => {
    expect(() => parseChannelInput(input)).toThrow(message);
    try {
      parseChannelInput(input);
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_SOURCE_INPUT" });
    }
  });
});
