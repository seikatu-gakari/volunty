import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: vi.fn(),
    },
  }),
}));

describe("LoginPage", () => {
  it("メールログインUIを表示せずGoogleログインだけ表示する", () => {
    render(<LoginPage />);

    expect(screen.getByRole("button", { name: "Googleでログイン" })).toBeDefined();
    expect(screen.queryByLabelText("メールアドレス")).toBeNull();
    expect(screen.queryByLabelText("パスワード")).toBeNull();
    expect(screen.queryByRole("button", { name: "ログイン" })).toBeNull();
    expect(screen.queryByText("または")).toBeNull();
  });
});
