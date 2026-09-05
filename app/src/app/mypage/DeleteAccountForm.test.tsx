import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteAccountForm } from "./DeleteAccountForm";

const mocks = vi.hoisted(() => ({
  actionState: { error: null as string | null },
  formAction: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [mocks.actionState, mocks.formAction, false],
  };
});

vi.mock("@/app/components/ui/ToastProvider", () => ({
  useToast: () => ({
    showToast: mocks.showToast,
  }),
}));

vi.mock("@/lib/mypage/actions", () => ({
  deleteMyAccount: vi.fn(),
}));

describe("DeleteAccountForm", () => {
  beforeEach(() => {
    mocks.actionState.error = null;
    mocks.showToast.mockClear();
  });

  it("削除失敗時はインラインエラーに加えてエラートーストを表示する", async () => {
    mocks.actionState.error = "確認欄に「削除する」と入力してください。";

    render(<DeleteAccountForm enabled />);

    expect(
      screen.getByText("確認欄に「削除する」と入力してください。")
    ).toBeDefined();
    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        type: "error",
        title: "アカウント削除に失敗しました",
        description: "確認欄に「削除する」と入力してください。",
      });
    });
  });

  it("kill switch 無効時は入力と削除ボタンを無効化する", () => {
    render(<DeleteAccountForm enabled={false} />);

    expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "現在利用できません" })).toHaveProperty(
      "disabled",
      true
    );
  });
});
