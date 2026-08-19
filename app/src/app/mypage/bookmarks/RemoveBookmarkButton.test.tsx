import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemoveBookmarkButton } from "./RemoveBookmarkButton";

const mocks = vi.hoisted(() => ({
  removeBookmark: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/bookmarks/actions", () => ({
  removeBookmark: mocks.removeBookmark,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

describe("RemoveBookmarkButton", () => {
  beforeEach(() => {
    mocks.removeBookmark.mockReset();
    mocks.refresh.mockReset();
  });

  it("クリックで removeBookmark を呼び、成功時に router.refresh する", async () => {
    mocks.removeBookmark.mockResolvedValue({ success: true });
    render(<RemoveBookmarkButton opportunityId="opp-1" />);

    fireEvent.click(screen.getByRole("button", { name: /リストから外す/ }));

    await waitFor(() =>
      expect(mocks.removeBookmark).toHaveBeenCalledWith("opp-1")
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("失敗時はエラーメッセージを表示する", async () => {
    mocks.removeBookmark.mockResolvedValue({
      success: false,
      error: "予期しないエラーが発生しました",
    });
    render(<RemoveBookmarkButton opportunityId="opp-1" />);

    fireEvent.click(screen.getByRole("button", { name: /リストから外す/ }));

    await waitFor(() =>
      expect(
        screen.getByText("予期しないエラーが発生しました")
      ).toBeDefined()
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
