import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { removeBookmark } from "@/lib/bookmarks/actions";
import { BookmarkList } from "./BookmarkList";

vi.mock("@/lib/bookmarks/actions", () => ({
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

describe("BookmarkList", () => {
  it("解除後に案件を一覧から取り除く", async () => {
    vi.mocked(removeBookmark).mockResolvedValue({ success: true });
    render(
      <BookmarkList
        initialBookmarks={[
          {
            id: "opp-1",
            title: "清掃活動",
            description: null,
            organizationName: "テスト団体",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "後で見るから解除" }));

    await waitFor(() => expect(screen.queryByText("清掃活動")).toBeNull());
    expect(
      screen.getByText("後で見る案件はまだありません。")
    ).not.toBeNull();
  });
});
