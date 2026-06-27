import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERSONAS, resolvePersona } from "./personas";

describe("resolvePersona", () => {
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
