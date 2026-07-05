import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERSONAS, resolvePersona } from "./personas";

describe("resolvePersona", () => {
  it.each([
    "participant-diagnosis",
    "participant-lifecycle",
    "participant-delete",
  ])("%s を参加者ペルソナとして解決できる", (key) => {
    expect(resolvePersona(key)?.role).toBe("participant");
  });

  it.each([
    "organization-fresh",
    "organization-reapply",
    "organization-profile-review",
    "organization-lifecycle",
    "organization-foreign",
  ])("%s を団体ペルソナとして解決できる", (key) => {
    expect(resolvePersona(key)?.role).toBe("organization");
  });

  it("定義済みの persona キーを解決できる", () => {
    for (const [key, persona] of Object.entries(PERSONAS)) {
      expect(resolvePersona(key)).toEqual(persona);
      expect(persona.key).toBe(key);
    }
  });

  it("不明なキーは null を返す", () => {
    expect(resolvePersona("unknown-key")).toBeNull();
    expect(resolvePersona("")).toBeNull();
  });
});
