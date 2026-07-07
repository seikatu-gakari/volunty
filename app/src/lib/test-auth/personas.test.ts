import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERSONAS, resolvePersona } from "./personas";

describe("resolvePersona", () => {
  it("Issue #168 の管理者E2E専用 persona を提供する", () => {
    expect(PERSONAS["user-suspendable"]).toMatchObject({
      key: "user-suspendable",
      email: "e2e-user-suspendable@example.com",
      role: "participant",
    });
    expect(PERSONAS["admin-review"]).toMatchObject({
      key: "admin-review",
      email: "e2e-admin-review@example.com",
      role: "admin",
    });
    expect(PERSONAS["organization-review-approve"]).toMatchObject({
      key: "organization-review-approve",
      email: "e2e-org-review-approve@example.com",
      role: "organization",
    });
    expect(PERSONAS["organization-review-reject"]).toMatchObject({
      key: "organization-review-reject",
      email: "e2e-org-review-reject@example.com",
      role: "organization",
    });
  });

  it("古い participant-suspendable key は解決しない", () => {
    expect(resolvePersona("participant-suspendable")).toBeNull();
  });

  it("E2E persona の email は重複しない", () => {
    const emails = Object.values(PERSONAS).map((persona) => persona.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it.each([
    "participant-diagnosis",
    "participant-lifecycle",
    "participant-delete",
  ])("%s を参加者ペルソナとして解決できる", (key) => {
    expect(resolvePersona(key)?.role).toBe("participant");
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
