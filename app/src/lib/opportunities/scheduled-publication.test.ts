import { describe, expect, it } from "vitest";
import { parseScheduledPublication } from "./scheduled-publication";

const NOW = new Date("2026-09-06T00:00:00.000Z");

describe("parseScheduledPublication", () => {
  it.each([
    [null, "公開予約日時を入力してください"],
    ["", "公開予約日時を入力してください"],
    ["   ", "公開予約日時を入力してください"],
  ])("%j は入力必須エラーになる", (value, error) => {
    expect(parseScheduledPublication(value, NOW)).toEqual({
      success: false,
      error,
    });
  });

  it.each([
    [new File(["2026-09-20T10:00"], "publishedAt.txt")],
    [" 2026-09-20T10:00"],
    ["2026-09-20T10:00 "],
    ["2026-9-20T10:00"],
    ["2026-09-20 10:00"],
    ["2026-09-20T10:00:00"],
    ["2026-09-20T10:00Z"],
    ["2026-09-20T10:00+09:00"],
    ["0000-01-01T00:00"],
    ["10000-01-01T00:00"],
    ["2026-00-10T10:00"],
    ["2026-13-01T10:00"],
    ["2026-09-20T24:00"],
    ["2026-09-20T10:60"],
    ["2026-02-30T10:00"],
    ["2025-02-29T10:00"],
  ])("%j は形式エラーになる", (value) => {
    expect(parseScheduledPublication(value, NOW)).toEqual({
      success: false,
      error: "公開予約日時の形式が正しくありません",
    });
  });

  it.each([
    ["2024-02-29T10:00", "2024-02-29T01:00:00.000Z"],
    ["2026-09-20T10:00", "2026-09-20T01:00:00.000Z"],
    ["2026-01-01T00:00", "2025-12-31T15:00:00.000Z"],
    ["9999-12-31T23:59", "9999-12-31T14:59:00.000Z"],
  ])("%s をJSTのUTC ISO日時へ変換する", (value, publishedAt) => {
    expect(parseScheduledPublication(value, new Date("1900-01-01T00:00:00Z"))).toEqual({
      success: true,
      publishedAt,
    });
  });

  it.each([
    ["2026-09-05T23:59", "過去"],
    ["2026-09-06T09:00", "現在"],
  ])("%s は現在より後でないため%sエラーになる", (value) => {
    expect(parseScheduledPublication(value, NOW)).toEqual({
      success: false,
      error: "公開予約日時は現在より後の日時を指定してください",
    });
  });

  it("現在より1分後の日時を受理する", () => {
    expect(parseScheduledPublication("2026-09-06T09:01", NOW)).toEqual({
      success: true,
      publishedAt: "2026-09-06T00:01:00.000Z",
    });
  });

  it("nowの秒以下を含んでいても入力時刻の瞬間と比較する", () => {
    expect(
      parseScheduledPublication(
        "2026-09-06T09:01",
        new Date("2026-09-06T00:00:59.999Z"),
      ),
    ).toEqual({
      success: true,
      publishedAt: "2026-09-06T00:01:00.000Z",
    });
  });
});
