import { describe, expect, it } from "vitest";
import { normalizeWaitlistEmail } from "@/lib/waitlist/validation";

describe("待機リストのメール検証", () => {
  it("前後の空白と大小文字を正規化する", () => {
    expect(normalizeWaitlistEmail(" Person+News@EXAMPLE.COM ")).toBe("person+news@example.com");
  });
  it.each([null, 1, "", "invalid", "a@b", "a b@example.com", "a@@example.com", ".a@example.com", "a..b@example.com", "a.@example.com", "a@-example.com", "a@example..com", "あ@example.com", `${"a".repeat(65)}@example.com`, `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}`])("不正な形式や上限超過を拒否する: %s", (value) => {
    expect(normalizeWaitlistEmail(value)).toBeNull();
  });
  it("254文字までは受け付ける", () => {
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    expect(email.length).toBe(254);
    expect(normalizeWaitlistEmail(email)).toBe(email);
  });
});
