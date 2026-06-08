import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupProfilePage from "./page";
import { SIGNUP_TEMP_KEY } from "@/app/(auth)/signup/page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: mocks.signUp,
    },
  }),
}));

describe("SignupProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(
      SIGNUP_TEMP_KEY,
      JSON.stringify({ email: "new-user@example.com" })
    );
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it("確認メールリンクがロール選択画面へ戻るよう emailRedirectTo を指定する", async () => {
    render(<SignupProfilePage />);

    fireEvent.change(screen.getByLabelText("お名前"), {
      target: { value: "山田 太郎" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalled());

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "new-user@example.com",
      password: "password123",
      options: {
        data: {
          full_name: "山田 太郎",
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/role`,
      },
    });
    expect(mocks.push).toHaveBeenCalledWith("/signup/complete");
  });
});
