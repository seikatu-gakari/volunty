import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicantStatusDate } from "./ApplicantStatusDate";

describe("ApplicantStatusDate", () => {
  it("DBのUTC日時を日本時間の応募日として表示する", () => {
    render(
      <ApplicantStatusDate
        label="応募日"
        value="2026-07-14T16:10:00.000"
      />
    );

    expect(screen.getByText("応募日: 2026/7/15")).toBeTruthy();
  });
});
