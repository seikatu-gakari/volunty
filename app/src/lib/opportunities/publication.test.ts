import { describe, expect, it } from "vitest";
import {
  isOpportunityPublic,
  resolvePublicationState,
  type OpportunityPublicationState,
} from "./publication";

const NOW = new Date("2026-09-06T03:00:00.000Z");

function state(
  status: OpportunityPublicationState["status"],
  publishedAt: OpportunityPublicationState["publishedAt"] = null,
): OpportunityPublicationState {
  return { status, publishedAt };
}

describe("resolvePublicationState", () => {
  it.each([
    [
      "下書きから募集中",
      state("draft"),
      { kind: "status", status: "published" },
      state("published", NOW),
    ],
    [
      "募集終了から募集中",
      state("closed", new Date("2026-08-01T00:00:00.000Z")),
      { kind: "status", status: "published" },
      state("published", NOW),
    ],
    [
      "公開中の内容編集",
      state("published", new Date("2026-08-01T00:00:00.000Z")),
      { kind: "status", status: "published" },
      state("published", new Date("2026-08-01T00:00:00.000Z")),
    ],
    [
      "公開予約中の内容編集",
      state("published", new Date("2026-09-07T00:00:00.000Z")),
      { kind: "status", status: "published" },
      state("published", new Date("2026-09-07T00:00:00.000Z")),
    ],
    [
      "公開日時NULLの不整合から募集中",
      state("published"),
      { kind: "status", status: "published" },
      state("published", NOW),
    ],
    [
      "募集中から下書き",
      state("published", new Date("2026-08-01T00:00:00.000Z")),
      { kind: "status", status: "draft" },
      state("draft"),
    ],
    [
      "予約から募集終了",
      state("published", new Date("2026-09-07T00:00:00.000Z")),
      { kind: "status", status: "closed" },
      state("closed", new Date("2026-09-07T00:00:00.000Z")),
    ],
    [
      "公開日時NULLから募集終了",
      state("published"),
      { kind: "status", status: "closed" },
      state("closed"),
    ],
    [
      "操作省略",
      state("published", new Date("2026-08-01T00:00:00.000Z")),
      null,
      state("published", new Date("2026-08-01T00:00:00.000Z")),
    ],
  ] as const)("%s", (_name, current, operation, expected) => {
    expect(resolvePublicationState(current, operation, NOW)).toEqual(expected);
  });

  it("明示的な公開方法は即時公開・下書き・予約をそのまま反映する", () => {
    const current = state("published", new Date("2026-08-01T00:00:00.000Z"));

    expect(
      resolvePublicationState(current, { kind: "publishMode", mode: "published" }, NOW),
    ).toEqual(state("published", NOW));
    expect(
      resolvePublicationState(current, { kind: "publishMode", mode: "draft" }, NOW),
    ).toEqual(state("draft"));
    expect(
      resolvePublicationState(
        current,
        {
          kind: "publishMode",
          mode: "scheduled",
          publishedAt: new Date("2026-09-10T00:00:00.000Z"),
        },
        NOW,
      ),
    ).toEqual(state("published", new Date("2026-09-10T00:00:00.000Z")));
  });
});

describe("isOpportunityPublic", () => {
  it.each([
    ["過去の公開日時", state("published", "2026-09-06T02:59:59.999Z"), true],
    ["境界一致", state("published", NOW), true],
    ["未来の公開日時", state("published", "2026-09-06T03:00:00.001Z"), false],
    ["公開日時NULL", state("published"), false],
    ["下書き", state("draft", "2026-09-06T02:00:00.000Z"), false],
    ["募集終了", state("closed", "2026-09-06T02:00:00.000Z"), false],
    ["不正な文字列日時", state("published", "not-a-date"), false],
    ["不正なDate日時", state("published", new Date("invalid")), false],
  ] as const)("%s は公開可否を %s と判定する", (_name, current, expected) => {
    expect(isOpportunityPublic(current, NOW)).toBe(expected);
  });
});
