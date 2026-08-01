import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignupProfilePage from "./page";
import { SIGNUP_TEMP_KEY } from "@/app/(auth)/signup/constants";

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
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://volunty.jp/");
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("確認メールを本番環境の認証コールバックURLで送信する", async () => {
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
        emailRedirectTo: "https://volunty.jp/auth/callback",
      },
    });
    expect(mocks.push).toHaveBeenCalledWith("/signup/complete");
  });

  it("本番URLが未設定でもvolunty.jpの認証コールバックURLを使用する", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("NODE_ENV", "production");

    render(<SignupProfilePage />);

    fireEvent.change(screen.getByLabelText("お名前"), {
      target: { value: "山田 太郎" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalled());

    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://volunty.jp/auth/callback",
        }),
      })
    );
  });
});
