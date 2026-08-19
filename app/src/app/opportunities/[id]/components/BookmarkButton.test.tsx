import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookmarkButton } from "./BookmarkButton";

const mocks = vi.hoisted(() => ({
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock("@/lib/bookmarks/actions", () => ({
  addBookmark: mocks.addBookmark,
  removeBookmark: mocks.removeBookmark,
}));

describe("BookmarkButton", () => {
  beforeEach(() => {
    mocks.addBookmark.mockReset();
    mocks.removeBookmark.mockReset();
  });

  it("未登録時は「後で見る」と表示し、クリックで addBookmark を呼ぶ", async () => {
    mocks.addBookmark.mockResolvedValue({ success: true });
    render(<BookmarkButton opportunityId="opp-1" />);

    const button = screen.getByRole("button", { name: /後で見る/ });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);

    await waitFor(() =>
      expect(mocks.addBookmark).toHaveBeenCalledWith("opp-1")
    );
    expect(screen.getByText("保存済み")).toBeDefined();
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("登録済み時は「保存済み」と表示し、クリックで removeBookmark を呼ぶ", async () => {
    mocks.removeBookmark.mockResolvedValue({ success: true });
    render(<BookmarkButton opportunityId="opp-1" initialBookmarked />);

    const button = screen.getByRole("button", { name: /保存済み/ });
    expect(button.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(button);

    await waitFor(() =>
      expect(mocks.removeBookmark).toHaveBeenCalledWith("opp-1")
    );
    expect(screen.getByText("後で見る")).toBeDefined();
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("失敗時は楽観的更新をロールバックする", async () => {
    mocks.addBookmark.mockResolvedValue({
      success: false,
      error: "公開中の案件が見つかりません",
    });
    render(<BookmarkButton opportunityId="opp-1" />);

    fireEvent.click(screen.getByRole("button", { name: /後で見る/ }));

    await waitFor(() =>
      expect(screen.getByText("公開中の案件が見つかりません")).toBeDefined()
    );
    expect(screen.getByRole("button", { name: /後で見る/ })).toBeDefined();
    expect(
      screen.getByRole("button", { name: /後で見る/ }).getAttribute("aria-pressed")
    ).toBe("false");
  });
});
