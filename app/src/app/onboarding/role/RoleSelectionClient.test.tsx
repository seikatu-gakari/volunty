import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleSelectionClient } from "./RoleSelectionClient";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  selectRole: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/onboarding/actions", () => ({
  selectRole: mocks.selectRole,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("RoleSelectionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未選択時は次へボタンが無効", () => {
    render(<RoleSelectionClient />);

    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
  });

  it("保存中は処理中表示になり、エラーを表示しない", async () => {
    const pending = deferred<never>();
    mocks.selectRole.mockReturnValue(pending.promise);
    render(<RoleSelectionClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /ボランティアに参加する/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(await screen.findByRole("button", { name: "処理中..." })).toBeDisabled();
    expect(
      screen.queryByText("ロールの保存中にエラーが発生しました")
    ).not.toBeInTheDocument();
  });

  it.each([
    ["ボランティアに参加する", "/onboarding/participant"],
    ["ボランティアを募集する", "/onboarding/organization"],
  ])("%s の保存成功時はエラーを表示せず %s へ遷移する", async (roleName, redirectTo) => {
    mocks.selectRole.mockResolvedValue({ success: true, redirectTo });
    render(<RoleSelectionClient />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(roleName) }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(redirectTo));
    expect(
      screen.queryByText("ロールの保存中にエラーが発生しました")
    ).not.toBeInTheDocument();
  });

  it("失敗結果では遷移せずエラーを表示して再試行できる", async () => {
    mocks.selectRole.mockResolvedValue({
      success: false,
      error: "ロールの保存中にエラーが発生しました",
    });
    render(<RoleSelectionClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /ボランティアに参加する/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      await screen.findByText("ロールの保存中にエラーが発生しました")
    ).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "次へ" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    await waitFor(() => expect(mocks.selectRole).toHaveBeenCalledTimes(2));
  });

  it("予期しないrejectでも汎用エラーを表示する", async () => {
    mocks.selectRole.mockRejectedValue(new Error("unexpected"));
    render(<RoleSelectionClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /ボランティアに参加する/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      await screen.findByText("ロールの保存中にエラーが発生しました")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次へ" })).toBeEnabled();
  });
});
