import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock("@/lib/bookmarks/actions", () => ({
  addBookmark: (...args: unknown[]) => mocks.addBookmark(...args),
  removeBookmark: (...args: unknown[]) => mocks.removeBookmark(...args),
}));

const { BookmarkButton } = await import("./BookmarkButton");

describe("BookmarkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addBookmark.mockResolvedValue({ success: true });
    mocks.removeBookmark.mockResolvedValue({ success: true });
  });

  it("未保存なら後で見るを追加できる", async () => {
    render(<BookmarkButton opportunityId="opp-1" />);

    fireEvent.click(screen.getByRole("button", { name: "後で見る" }));

    await waitFor(() => {
      expect(mocks.addBookmark).toHaveBeenCalledWith("opp-1");
    });
    expect(
      await screen.findByText("お気に入りに追加しました")
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "リストから外す" })).toBeDefined();
  });

  it("保存済みならリストから外せる", async () => {
    render(<BookmarkButton opportunityId="opp-1" initialBookmarked />);

    fireEvent.click(screen.getByRole("button", { name: "リストから外す" }));

    await waitFor(() => {
      expect(mocks.removeBookmark).toHaveBeenCalledWith("opp-1");
    });
    expect(await screen.findByText("後で見るから外しました")).toBeDefined();
    expect(screen.getByRole("button", { name: "後で見る" })).toBeDefined();
  });
});
