import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

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
      getUser: vi.fn(async () => ({ data: { user: null } })),
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
  it("未ログイン時はカタカナブランドと公開用モバイルメニューを表示する", async () => {
    render(await Header());

    expect(screen.getByRole("link", { name: /ボランティー/ })).toBeDefined();
    expect(screen.getByRole("link", { name: "ログイン" })).toBeDefined();
    expect(screen.getByRole("button", { name: "メニューを開く" })).toBeDefined();
    expect(screen.queryByText("認証済みナビゲーション")).toBeNull();
  });
});
