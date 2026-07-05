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
// 旧・独自BIG5尺度（10問版 / 96問版 / 16〜60問の2モード表記 / 60問版）のコピーが
// 残っていないことを確認する。「15問」は今回復活させたIPIP-BFM-50抜粋版の簡易診断
// であり、旧・独自16問版とは別物のため禁止パターンには含めない。
const oldQuestionCopyPattern = new RegExp(
  `(?:10${questionUnit}|96${questionUnit}|16${waveDash}60${questionUnit}|16${questionUnit}|60${questionUnit})`,
);

describe("診断設問数コピー", () => {
  it("ログイン後トップで簡易診断（15問）と全50問の2モード診断仕様を表示する", () => {
    render(<AuthenticatedHome user={user} />);

    expect(
      screen.getByText(
        /簡易診断（15問）または全50問の質問で、5つの性格特性の傾向を確認します/,
      ),
    ).toBeDefined();
    expect(
      screen.getByText("簡易診断（15問・約2分）/ 全50問（約5〜8分）から選べます"),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
  });

  it("LPの診断説明で簡易15問・全50問の2モード診断仕様を表示する", () => {
    const { rerender } = render(<HowToUseSection />);

    expect(
      screen.getByText(
        /性格傾向チェック（簡易15問・約2分\/全50問・約5〜8分から選べます）で、あなたの特性の傾向を確認。登録は無料です。/,
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();

    rerender(<HowItWorksSection />);

    expect(
      screen.getByText(
        /国際的に公開されている性格研究用の質問項目（IPIP）で、5つの性格特性の傾向を確認します。簡易診断（15問）と全50問から選べます。/,
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
  });
});
