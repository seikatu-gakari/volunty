import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBookmark, removeBookmark } from "@/lib/bookmarks/actions";
import { BookmarkButton } from "./BookmarkButton";

vi.mock("@/lib/bookmarks/actions", () => ({
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

describe("BookmarkButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("未登録なら追加し、登録済み表示へ切り替える", async () => {
    vi.mocked(addBookmark).mockResolvedValue({ success: true });
    render(<BookmarkButton opportunityId="opp-1" initialBookmarked={false} />);

    fireEvent.click(screen.getByRole("button", { name: "後で見る" }));

    await waitFor(() => expect(addBookmark).toHaveBeenCalledWith("opp-1"));
    expect(
      screen.getByRole("button", { name: "後で見るから解除" })
    ).toBeInTheDocument();
    expect(screen.getByText("お気に入りに追加しました")).toBeInTheDocument();
  });

  it("登録済みなら解除し、未登録表示へ切り替える", async () => {
    vi.mocked(removeBookmark).mockResolvedValue({ success: true });
    render(<BookmarkButton opportunityId="opp-1" initialBookmarked />);

    fireEvent.click(screen.getByRole("button", { name: "後で見るから解除" }));

    await waitFor(() => expect(removeBookmark).toHaveBeenCalledWith("opp-1"));
    expect(screen.getByRole("button", { name: "後で見る" })).toBeInTheDocument();
    expect(screen.getByText("お気に入りを解除しました")).toBeInTheDocument();
  });
});
