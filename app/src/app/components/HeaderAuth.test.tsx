import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ linkPending: false }));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    onClick,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
    onClick?: () => void;
  }) => (
    <a className={className} href={href} onClick={onClick}>
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: mocks.linkPending }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { HeaderAuth } from "./HeaderAuth";

describe("HeaderAuth の主要ナビゲーション", () => {
  beforeEach(() => {
    mocks.linkPending = false;
  });

  it("遷移待ちでは各主要ナビLinkに読み込み状態を表示する", () => {
    mocks.linkPending = true;

    render(
      <HeaderAuth
        identity={{
          id: "participant-1",
          email: "participant@example.com",
          displayName: "参加者 太郎",
        }}
        userState={{
          role: "participant",
          onboardingCompleted: true,
          verified: false,
        }}
      />,
    );

    expect(
      screen.getAllByRole("status", { name: "ページを読み込み中" }),
    ).toHaveLength(3);
  });

  it("待機していない主要ナビLinkには読み込み状態を表示しない", () => {
    render(
      <HeaderAuth
        identity={{
          id: "participant-1",
          email: "participant@example.com",
          displayName: "参加者 太郎",
        }}
        userState={{
          role: "participant",
          onboardingCompleted: true,
          verified: false,
        }}
      />,
    );

    expect(
      screen.queryByRole("status", { name: "ページを読み込み中" }),
    ).toBeNull();
  });

  it("認証済みモバイルメニューで共通トリガー契約とロール別リンクを維持する", () => {
    render(
      <HeaderAuth
        identity={{ id: "participant-1", email: "participant@example.com", displayName: "参加者 太郎" }}
        userState={{ role: "participant", onboardingCompleted: true, verified: false }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "メニューを開く" });
    expect(trigger.className).toContain("size-10");
    expect(trigger.className).toContain("rounded-lg");
    expect(trigger.querySelector("svg")?.classList.contains("size-5")).toBe(true);
    expect(trigger.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "メニューを閉じる" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("link", { name: "マイページ" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "ログアウト" })).toHaveLength(2);
  });
});
