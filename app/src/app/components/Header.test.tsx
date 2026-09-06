import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getViewerContext: vi.fn() }));

vi.mock("server-only", () => ({}));

vi.mock("next/link", () => ({
  default: ({ children, href, className, "aria-label": ariaLabel }: {
    children: ReactNode;
    href: string;
    className?: string;
    "aria-label"?: string;
  }) => <a href={href} className={className} aria-label={ariaLabel}>{children}</a>,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: mocks.getViewerContext,
}));

vi.mock("@/app/components/HeaderAuth", () => ({
  HeaderAuth: ({ identity, userState }: {
    identity: { displayName: string | null } | null;
    userState: { role: string | null; onboardingCompleted: boolean; verified: boolean };
  }) => (
    <div>
      <div>{identity ? "認証済みナビゲーション" : "未認証ナビゲーション"}</div>
      {userState.onboardingCompleted && userState.role === "participant" && (
        <a href="/mypage">マイページ</a>
      )}
      {userState.onboardingCompleted && userState.role === "organization" && userState.verified && (
        <a href="/dashboard">ダッシュボード</a>
      )}
    </div>
  ),
}));

import { Header } from "./Header";

describe("Header", () => {
  beforeEach(() => {
    mocks.getViewerContext.mockResolvedValue({ status: "guest" });
  });

  it("landingヘッダーのguestだけLPアンカーと公開ナビゲーションを表示する", async () => {
    render(await Header({ variant: "landing" }));

    expect(screen.getByRole("link", { name: "使い方" }).getAttribute("href")).toBe("#usage");
    expect(screen.getByRole("link", { name: "ボランティ ホーム" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("認証済みナビゲーション")).toBeNull();
  });

  it("DB roleとプロフィール完了状態を受け取った参加者を認証ナビゲーションとして表示する", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      identity: { id: "participant-1", email: "p@example.com", displayName: "参加者 太郎" },
      role: "participant",
      isActive: true,
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
      organizationVerified: false,
      organizationReviewStatus: null,
    });

    render(await Header({ variant: "landing" }));

    expect(screen.getByText("認証済みナビゲーション")).toBeDefined();
    expect(screen.getByRole("link", { name: "マイページ" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "使い方" })).toBeNull();
  });

  it("凍結済みidentityにはロール別ナビゲーションを表示しない", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      identity: { id: "participant-1", email: "p@example.com", displayName: null },
      role: "participant",
      isActive: false,
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
      organizationVerified: false,
      organizationReviewStatus: null,
    });

    render(await Header());

    expect(screen.queryByRole("link", { name: "マイページ" })).toBeNull();
  });
});
