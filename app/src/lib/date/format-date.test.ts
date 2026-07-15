import { describe, expect, it } from "vitest";
import { formatDateInJapan } from "@/lib/date/format-date";

describe("formatDateInJapan", () => {
  it("UTCでは前日でも日本時間の日付で表示する", () => {
    expect(formatDateInJapan("2026-07-14T16:05:00.000Z")).toBe("2026/7/15");
  });

  it("DBから返るタイムゾーンなしのUTC日時を日本時間の日付で表示する", () => {
    expect(formatDateInJapan("2026-07-14T16:05:00.000")).toBe("2026/7/15");
  });
});
