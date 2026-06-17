import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationProfileForm } from "./OrganizationProfileForm";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  registerOrganization: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/lib/onboarding/actions", () => ({
  registerOrganization: mocks.registerOrganization,
}));

describe("OrganizationProfileForm", () => {
  beforeEach(() => {
    mocks.push.mockClear();
    mocks.registerOrganization.mockReset();
    mocks.registerOrganization.mockResolvedValue({ success: true });
  });

  it("LINE公式アカウントIDを必須項目として表示する", () => {
    render(<OrganizationProfileForm />);

    expect(screen.getByRole("heading", { name: "LINE 連携" })).toBeDefined();
    expect(screen.queryByText("LINE 連携（任意）")).toBeNull();
    expect(
      screen.getByText(
        "参加者との連絡に使用する団体・公式LINEアカウントのIDを入力してください。"
      )
    ).toBeDefined();
    expect(
      screen.getByText(
        "個人アカウントではなく、団体で管理できるアカウントの利用を推奨します。"
      )
    ).toBeDefined();

    const lineIdInput = screen.getByLabelText(
      "LINE公式アカウントID"
    ) as HTMLInputElement;
    expect(lineIdInput.required).toBe(true);
    expect(screen.getByLabelText("LINE 友達追加 URL")).toBeDefined();
  });

  it("LINE公式アカウントIDが未入力の場合は登録処理を中断する", async () => {
    render(<OrganizationProfileForm />);

    fireEvent.change(screen.getByLabelText("団体名"), {
      target: { value: "NPO法人テスト" },
    });
    fireEvent.change(screen.getByLabelText("代表者名"), {
      target: { value: "山田 太郎" },
    });
    fireEvent.change(screen.getByLabelText("連絡先メールアドレス"), {
      target: { value: "contact@example.org" },
    });
    fireEvent.click(screen.getByLabelText("東京都"));
    fireEvent.click(
      screen.getByRole("button", { name: "登録して審査を申請する" })
    );

    await waitFor(() => {
      expect(screen.getByText("LINE公式アカウントIDは必須です")).toBeDefined();
    });
    expect(mocks.registerOrganization).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
