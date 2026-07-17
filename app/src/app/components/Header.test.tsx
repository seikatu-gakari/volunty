import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const { getUserMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
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
  prisma: {},
}));

vi.mock("@/app/components/HeaderAuth", () => ({
  HeaderAuth: () => <div>認証済みナビゲーション</div>,
}));

describe("Header", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: null } });
  });

  it("通常ヘッダーの未ログイン時はLPアンカーを表示せず従来の認証ナビゲーションを表示する", async () => {
    render(await Header());

    expect(screen.getByRole("link", { name: /ボランティー/ })).toBeDefined();
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
    expect(screen.getByRole("link", { name: "ログイン" })).toBeDefined();
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
});
