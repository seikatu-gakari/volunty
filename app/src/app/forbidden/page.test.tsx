import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={prefetch?.toString()}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

import ForbiddenPage from "./page";

describe("ForbiddenPage", () => {
  it("アクセス元のロールや画面を限定しない案内を表示する", () => {
    render(<ForbiddenPage />);

    expect(
      screen.getByText(
        "現在のアカウントの権限では、このページを表示できません。",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/role が admin/)).toBeNull();
  });

  it("トップとアカウント切り替えの固定導線を表示する", () => {
    render(<ForbiddenPage />);

    expect(
      screen.getByRole("link", { name: "トップへ戻る" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen
        .getByRole("link", { name: "別のアカウントでログイン" })
        .getAttribute("href"),
    ).toBe("/auth/signout?intent=switch-account");
    expect(
      screen
        .getByRole("link", { name: "別のアカウントでログイン" })
        .getAttribute("data-prefetch"),
    ).toBe("false");
  });
});
