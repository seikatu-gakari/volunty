import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagnosisTypesGrid } from "./DiagnosisTypesGrid";

describe("DiagnosisTypesGrid", () => {
  it("診断時間の注記を本文色で読みやすく表示する", () => {
    render(<DiagnosisTypesGrid />);

    const note = screen.getByText(/全50問の性格傾向チェック/);
    expect(note.className).toContain("text-text-body");
    expect(note.className).not.toContain("text-text-body/70");
    expect(note.className).not.toContain("opacity-70");
  });
});
