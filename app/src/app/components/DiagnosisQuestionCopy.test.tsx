import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AuthenticatedHome } from "./AuthenticatedHome";
import { UsageSection } from "./lp/UsageSection";
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

const identity = {
  id: "test-user",
  email: "test@example.com",
  displayName: "テストユーザー",
};

const questionUnit = String.fromCharCode(0x554f);
const waveDash = String.fromCharCode(0x301c);
// 旧・独自BIG5尺度（10問版 / 96問版 / 16〜60問の2モード表記 / 60問版）のコピーが
// 残っていないことを確認する。「15問」は今回復活させたIPIP-BFM-50抜粋版の簡易診断
// であり、旧・独自16問版とは別物のため禁止パターンには含めない。
const oldQuestionCopyPattern = new RegExp(
  `(?:10${questionUnit}|96${questionUnit}|16${waveDash}60${questionUnit}|16${questionUnit}|60${questionUnit})`,
);

describe("診断設問数コピー", () => {
  it("ログイン直後のトップでは診断開始カードを表示しない", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="participant"
      />,
    );

    expect(screen.queryByText("性格傾向チェックを始める")).toBeNull();
    expect(screen.queryByText("診断を始める")).toBeNull();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
  });

  it("応募者トップに利用できる機能導線を表示する", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="participant"
      />,
    );

    expect(screen.getByRole("link", { name: /マイページ/ }).getAttribute("href")).toBe(
      "/mypage",
    );
    expect(
      screen.getByRole("link", { name: /おすすめ案件/ }).getAttribute("href"),
    ).toBe("/recommendations");
    expect(
      screen.getByRole("link", { name: /性格傾向チェック/ }).getAttribute("href"),
    ).toBe("/diagnosis");
    expect(screen.queryByRole("link", { name: /管理ダッシュボード/ })).toBeNull();
  });

  it("ログイン後トップでは利用の流れを表示しない", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="participant"
      />,
    );

    expect(screen.queryByRole("heading", { name: "利用の流れ" })).toBeNull();
  });

  it("募集団体トップに団体向け機能導線を表示する", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="organization"
        organizationVerified
      />,
    );

    expect(
      screen.getByRole("link", { name: /ダッシュボード/ }).getAttribute("href"),
    ).toBe("/dashboard");
    expect(
      screen.getByRole("link", { name: /新しい案件を作成/ }).getAttribute("href"),
    ).toBe("/dashboard/opportunities/new");
    expect(
      screen.getByRole("link", { name: /おすすめ参加者/ }).getAttribute("href"),
    ).toBe("/dashboard/participants");
    expect(screen.queryByRole("link", { name: /マイページ/ })).toBeNull();
  });

  it("管理者トップに管理機能導線を表示する", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="admin"
      />,
    );

    expect(
      screen.getByRole("link", { name: /管理ダッシュボード/ }).getAttribute("href"),
    ).toBe("/admin");
    expect(
      screen.getByRole("link", { name: /団体審査一覧/ }).getAttribute("href"),
    ).toBe("/admin/organizations");
    expect(
      screen.getByRole("link", { name: /ユーザー管理/ }).getAttribute("href"),
    ).toBe("/admin/users");
    expect(screen.queryByRole("link", { name: /マイページ/ })).toBeNull();
  });

  it("参加者プロフィール未登録カードを表示しない", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="participant"
      />,
    );

    expect(screen.queryByText("応募者登録を完了してください")).toBeNull();
    expect(screen.getByRole("link", { name: /マイページ/ })).toBeDefined();
  });

  it("団体プロフィール未登録カードを表示しない", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="organization"
      />,
    );

    expect(screen.queryByText("団体登録を完了してください")).toBeNull();
    expect(screen.getByRole("link", { name: /審査状況を確認/ })).toBeDefined();
  });

  it("LPの診断説明で簡易15問・全50問の2モード診断仕様を表示する", () => {
    render(<UsageSection />);

    expect(
      screen.getByText(
        /世界中で使われている性格研究をもとに、5つの性格特性の傾向を確認。簡易15問（約2分）と全50問（約5〜8分）から選べて、登録は無料です。/,
      ),
    ).toBeDefined();
    expect(screen.queryByText(oldQuestionCopyPattern)).toBeNull();
  });
});
