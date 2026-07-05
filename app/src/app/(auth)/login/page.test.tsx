import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.signInWithOAuth.mockClear();
    window.history.replaceState(null, "", "http://localhost:3000/login");
  });

  it("メールログインUIを表示せずGoogleログインだけ表示する", () => {
    render(<LoginPage />);

    expect(screen.getByRole("button", { name: "Googleでログイン" })).toBeDefined();
    expect(screen.queryByLabelText("メールアドレス")).toBeNull();
    expect(screen.queryByLabelText("パスワード")).toBeNull();
    expect(screen.queryByRole("button", { name: "ログイン" })).toBeNull();
    expect(screen.queryByText("または")).toBeNull();
  });

  it("next パラメータがある場合、Googleログインの callback URL に引き継ぐ", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/login?next=/mypage"
    );
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Googleでログイン" }));

    await waitFor(() => {
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback?next=%2Fmypage",
          queryParams: {
            prompt: "select_account",
          },
        },
      });
    });
  });

  it("凍結理由付きの場合はエラーメッセージを表示する", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/login?error=suspended"
    );

    render(<LoginPage />);

    expect(
      await screen.findByRole("alert", {
        name: "このアカウントは凍結されています。",
      })
    ).toBeDefined();
  });

  it("通常のログインでは凍結エラーを表示しない", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
