import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserSuspensionControl } from "./UserSuspensionControl";

const mocks = vi.hoisted(() => ({
  suspendUser: vi.fn(),
  reactivateUser: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/admin/actions", () => ({
  suspendUser: mocks.suspendUser,
  reactivateUser: mocks.reactivateUser,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const activeParticipant = {
  id: "u-1",
  role: "participant" as const,
  displayName: "山田太郎",
  email: "yamada@example.com",
  avatarUrl: null,
  isActive: true,
  suspendedAt: null,
  suspendReason: null,
  region: "東京都",
  organizationVerified: null,
  lastLoginAt: null,
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("UserSuspensionControl", () => {
  beforeEach(() => {
    mocks.suspendUser.mockReset();
    mocks.reactivateUser.mockReset();
    mocks.refresh.mockReset();
  });

  it("管理者ロールには操作を表示しない", () => {
    const { container } = render(
      <UserSuspensionControl user={{ ...activeParticipant, role: "admin" }} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("凍結ボタン押下で理由入力を要求し、Actionを呼ぶ", async () => {
    mocks.suspendUser.mockResolvedValue({ success: true });
    render(<UserSuspensionControl user={activeParticipant} />);

    fireEvent.click(screen.getByRole("button", { name: "凍結する" }));
    fireEvent.change(screen.getByPlaceholderText("凍結理由を入力してください"), {
      target: { value: "規約違反" },
    });
    fireEvent.click(screen.getByRole("button", { name: "凍結を確定" }));

    await waitFor(() =>
      expect(mocks.suspendUser).toHaveBeenCalledWith("u-1", "規約違反")
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("凍結中ユーザーには解除ボタンを表示する", async () => {
    mocks.reactivateUser.mockResolvedValue({ success: true });
    render(
      <UserSuspensionControl
        user={{
          ...activeParticipant,
          isActive: false,
          suspendReason: "規約違反",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "凍結を解除" }));

    await waitFor(() =>
      expect(mocks.reactivateUser).toHaveBeenCalledWith("u-1")
    );
  });
});
