import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpportunityCreatedDate } from "./OpportunityCreatedDate";

describe("OpportunityCreatedDate", () => {
  it("DBのUTC日時を日本時間の作成日として表示する", () => {
    render(<OpportunityCreatedDate createdAt="2026-07-14T16:05:00.000" />);

    expect(screen.getByText("作成日: 2026/7/15")).toBeTruthy();
  });
});
