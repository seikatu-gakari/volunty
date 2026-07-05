import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERSONAS, resolvePersona } from "./personas";

describe("resolvePersona", () => {
  it.each([
    "participant-diagnosis",
    "participant-lifecycle",
    "participant-delete",
    "participant-logout",
    "participant-suspended",
  ])("%s を参加者ペルソナとして解決できる", (key) => {
    expect(resolvePersona(key)?.role).toBe("participant");
  });

  it.each([
    ["organization-rejected", "organization"],
    ["organization-pending-readonly", "organization"],
    ["organization-secondary", "organization"],
  ] as const)("%s を %s ペルソナとして解決できる", (key, role) => {
    expect(resolvePersona(key)?.role).toBe(role);
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
