import { describe, expect, it } from "vitest";
import { applicationStatusLabel } from "./status";

describe("applicationStatusLabel", () => {
  it("辞退された応募を完了状態の文言で表示する", () => {
    expect(applicationStatusLabel("rejected")).toBe("辞退済み");
  });
});
