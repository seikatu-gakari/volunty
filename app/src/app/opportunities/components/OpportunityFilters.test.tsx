import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpportunityFilters } from "./OpportunityFilters";

describe("OpportunityFilters", () => {
  it("未送信の編集を条件なしの初期値へ戻す", () => {
    render(<OpportunityFilters filters={{}} />);

    const keyword = screen.getByRole("textbox", { name: "キーワード" });
    const category = screen.getByRole("combobox", { name: "カテゴリ" });
    const region = screen.getByRole("textbox", { name: "地域" });
    const participationMode = screen.getByRole("combobox", {
      name: "参加形態",
    });
    const weekend = screen.getByRole("checkbox", {
      name: "週末に参加できる",
    });
    const beginner = screen.getByRole("checkbox", { name: "初心者歓迎" });

    fireEvent.change(keyword, { target: { value: "ゴミ" } });
    fireEvent.change(category, { target: { value: "環境保全" } });
    fireEvent.change(region, { target: { value: "東京都" } });
    fireEvent.change(participationMode, { target: { value: "hybrid" } });
    fireEvent.click(weekend);
    fireEvent.click(beginner);

    fireEvent.click(screen.getByRole("link", { name: "条件を解除" }));

    expect(keyword).toHaveValue("");
    expect(category).toHaveValue("");
    expect(region).toHaveValue("");
    expect(participationMode).toHaveValue("");
    expect(weekend).not.toBeChecked();
    expect(beginner).not.toBeChecked();
  });

  it("修飾キー付きのクリア操作では元画面の編集を保持する", () => {
    render(<OpportunityFilters filters={{}} />);

    const keyword = screen.getByRole("textbox", { name: "キーワード" });
    fireEvent.change(keyword, { target: { value: "編集中" } });

    fireEvent.click(screen.getByRole("link", { name: "条件を解除" }), {
      ctrlKey: true,
    });

    expect(keyword).toHaveValue("編集中");
  });
});
