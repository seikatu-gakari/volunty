import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AuthenticatedHome } from "./AuthenticatedHome";
import { HowItWorksSection } from "./lp/HowItWorksSection";
import { HowToUseSection } from "./lp/HowToUseSection";
import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const user = {
  id: "test-user",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "テストユーザー" },
  created_at: "2026-06-15T00:00:00.000Z",
} as User;

const questionUnit = String.fromCharCode(0x554f);
const waveDash = String.fromCharCode(0x301c);
// 旧仕様（10問 / 96問 / 16〜60問 / 16問 / 60問）のコピーが残っていないことを確認する
const oldQuestionCopyPattern = new RegExp(
  `(?:10${questionUnit}|96${questionUnit}|16${waveDash}60${questionUnit}|16${questionUnit}|60${questionUnit})`,
);

describe("診断設問数コピー", () => {
  it("ログイン後トップで全50問・単一モードの診断仕様を表示する", () => {
    render(<AuthenticatedHome user={user} />);

    expect(
      screen.getByText("50問の質問で、5つの性格特性の傾向を確認します"),
    ).toBeDefined();
    expect(screen.getByText("性格傾向チェック（全50問）")).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
    // 旧2モードの表記が残っていない
    expect(screen.queryByText(/簡易診断/)).toBeNull();
    expect(screen.queryByText(/詳細診断/)).toBeNull();
  });

  it("LPの診断説明で全50問の診断仕様を表示する", () => {
    const { rerender } = render(<HowToUseSection />);

    expect(
      screen.getByText(
        "全50問の性格傾向チェック（約5〜8分）で、あなたの特性の傾向を確認。登録は無料です。",
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();

    rerender(<HowItWorksSection />);

    expect(
      screen.getByText(
        "国際的に公開されている性格研究用の質問項目（IPIP・全50問）で、5つの性格特性の傾向を確認します。",
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
  });
});
