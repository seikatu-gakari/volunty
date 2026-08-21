import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const { getUserMock, findOrganizationProfileMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  findOrganizationProfileMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationProfile: {
      findUnique: findOrganizationProfileMock,
    },
  },
}));

vi.mock("@/app/components/HeaderAuth", () => ({
  HeaderAuth: ({
    userState,
  }: {
    userState: {
      role: string | null;
      onboardingCompleted: boolean;
      verified: boolean;
    };
  }) => (
    <div>
      <div>認証済みナビゲーション</div>
      {userState.onboardingCompleted && userState.role === "participant" && (
        <a href="/mypage">マイページ</a>
      )}
      {userState.onboardingCompleted &&
        userState.role === "organization" &&
        userState.verified && <a href="/dashboard">ダッシュボード</a>}
    </div>
  ),
}));

describe("Header", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    findOrganizationProfileMock.mockReset();
    findOrganizationProfileMock.mockResolvedValue({
      verified: true,
      reviewStatus: "approved",
    });
  });

  it("通常ヘッダーの未ログイン時はLPアンカーを表示せず従来の認証ナビゲーションを表示する", async () => {
    render(await Header());

    expect(screen.getByRole("link", { name: /ボランティー/ })).toBeDefined();
    expect(screen.getByText("あなたにぴったりの活動を見つけよう").className).toContain(
      "hidden",
    );
    expect(screen.queryByRole("link", { name: "使い方" })).toBeNull();
    expect(screen.queryByRole("button", { name: "メニューを開く" })).toBeNull();
    expect(screen.getByText("認証済みナビゲーション")).toBeDefined();
    expect(screen.getByRole("banner").className).toContain("bg-background/60");
  });

  it("landingヘッダーの未ログイン時だけLPアンカーと公開ナビゲーションを表示する", async () => {
    render(await Header({ variant: "landing" }));

    expect(screen.getByRole("link", { name: "使い方" }).getAttribute("href")).toBe(
      "#usage",
    );
    const landingSubtitle = screen.getByText("あなたにぴったりの活動を見つけよう");
    expect(landingSubtitle.className).toContain("block");
    expect(landingSubtitle.className).not.toContain("hidden");
    expect(screen.getByRole("link", { name: "ログイン" }).className).toContain("hidden");
    expect(screen.getByRole("button", { name: "メニューを開く" })).toBeDefined();
    expect(screen.queryByText("認証済みナビゲーション")).toBeNull();
  });

  it("landingヘッダーでもログイン済みなら認証ナビゲーションを表示する", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "participant-1",
          user_metadata: {
            role: "participant",
            onboarding_completed: true,
          },
        },
      },
    });

    const { container } = render(await Header({ variant: "landing" }));

    expect(screen.getByText("認証済みナビゲーション")).toBeDefined();
    expect(screen.queryByRole("link", { name: "ログイン" })).toBeNull();
    expect(screen.queryByRole("link", { name: "使い方" })).toBeNull();
    expect(screen.getByRole("banner").className).toContain("bg-background/60");
    expect(container.querySelector(".lucide-heart")?.getAttribute("fill")).toBe(
      "currentColor",
    );
  });

  it("プロフィール完了状態を受け取った参加者はmetadata未完了でもナビを表示する", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "participant-1",
          user_metadata: {
            role: "participant",
            onboarding_completed: false,
          },
        },
      },
    });

    render(await Header({ variant: "landing", onboardingCompleted: true }));

    expect(screen.getByRole("link", { name: "マイページ" })).toBeDefined();
  });

  it("プロフィール完了状態を受け取った団体はmetadata未完了でもナビを表示する", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "organization-1",
          user_metadata: {
            role: "organization",
            onboarding_completed: false,
          },
        },
      },
    });

    render(await Header({ variant: "landing", onboardingCompleted: true }));

    expect(screen.getByRole("link", { name: "ダッシュボード" })).toBeDefined();
  });
});
