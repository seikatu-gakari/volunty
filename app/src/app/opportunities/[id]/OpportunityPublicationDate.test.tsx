import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpportunityPublicationDate } from "./OpportunityPublicationDate";

describe("OpportunityPublicationDate", () => {
  it("DBのUTC日時を日本時間の掲載日として表示する", () => {
    render(<OpportunityPublicationDate createdAt="2026-07-14T16:05:00.000" />);

    expect(screen.getByText("掲載日: 2026/7/15")).toBeTruthy();
  });
});
