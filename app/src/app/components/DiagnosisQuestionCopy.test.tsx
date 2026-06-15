import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AuthenticatedHome } from "./AuthenticatedHome";
import { HowItWorksSection } from "./lp/HowItWorksSection";
import { HowToUseSection } from "./lp/HowToUseSection";

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
const oldQuestionCopyPattern = new RegExp(
  `(?:10${questionUnit}|96${questionUnit}|16${waveDash}60${questionUnit})`,
);

describe("診断設問数コピー", () => {
  it("ログイン後トップの利用の流れで16問/60問の診断仕様を表示する", () => {
    render(<AuthenticatedHome user={user} />);

    expect(
      screen.getByText(
        "16問の簡易診断または60問の詳細診断で、あなたのボランティアタイプを診断します",
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
  });

  it("LPの診断説明で16問/60問の診断仕様を表示する", () => {
    const { rerender } = render(<HowToUseSection />);

    expect(
      screen.getByText(
        "16問の簡易診断または60問の詳細診断で、あなたの特性や興味を診断。登録は無料です。",
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();

    rerender(<HowItWorksSection />);

    expect(
      screen.getByText(
        "16問の簡易診断または60問の詳細診断で、あなたの価値観・適性・強みを数値で可視化します。",
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
  });
});
