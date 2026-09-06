import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signInWithOAuth: vi.fn(),
  prepareSignupConsent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}));

vi.mock("@/lib/legal/consent-actions", () => ({
  prepareSignupConsent: mocks.prepareSignupConsent,
}));

describe("SignupPage", () => {
  beforeEach(() => {
    mocks.push.mockClear();
    mocks.signInWithOAuth.mockClear();
    mocks.prepareSignupConsent.mockReset();
    mocks.prepareSignupConsent.mockResolvedValue({ success: true });
    mocks.signInWithOAuth.mockResolvedValue({ data: { provider: "google", url: null }, error: null });
    window.history.replaceState(null, "", "http://localhost:3000/signup");
  });

  it("メール登録UIを表示せず、同意前はGoogle登録を開始できない", () => {
    render(<SignupPage />);

    expect(
      (screen.getByRole("button", { name: "Googleで登録" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("checkbox")).toBeDefined();
    expect(screen.queryByLabelText("メールアドレス")).toBeNull();
    expect(screen.queryByRole("button", { name: "次へ (詳細情報の入力)" })).toBeNull();
    expect(screen.queryByText("または")).toBeNull();
  });

  it("Google登録時にアカウント選択を要求する", async () => {
    render(<SignupPage />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Googleで登録" }));

    await waitFor(() => {
      expect(mocks.prepareSignupConsent).toHaveBeenCalled();
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback",
          queryParams: {
            prompt: "select_account",
          },
        },
      });
    });
  });
});
