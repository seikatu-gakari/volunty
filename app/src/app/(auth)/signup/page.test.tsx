import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SignupPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: vi.fn(),
    },
  }),
}));

describe("SignupPage", () => {
  it("メール登録UIを表示せずGoogle登録だけ表示する", () => {
    render(<SignupPage />);

    expect(screen.getByRole("button", { name: "Googleで登録" })).toBeDefined();
    expect(screen.queryByLabelText("メールアドレス")).toBeNull();
    expect(screen.queryByRole("button", { name: "次へ (詳細情報の入力)" })).toBeNull();
    expect(screen.queryByText("または")).toBeNull();
  });
});
