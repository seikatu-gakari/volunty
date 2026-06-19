import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";

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

vi.mock("@/app/components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

describe("NotFound", () => {
  it("404メッセージと主要導線を表示する", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "削除された、URLが変更された、または入力したURLが間違っている可能性があります。",
      ),
    ).toBeDefined();

    expect(screen.getByText("ヘッダー")).toBeDefined();
    expect(
      screen.getByRole("link", { name: /トップへ戻る/ }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: /診断を始める/ }).getAttribute("href"),
    ).toBe("/diagnosis?mode=brief");
  });

  it("CTAをモバイルでは縦積み、広い画面では横並びにする", () => {
    const { container } = render(<NotFound />);

    const actions = container.querySelector("[data-testid='not-found-actions']");

    expect(actions?.className).toContain("flex-col");
    expect(actions?.className).toContain("sm:flex-row");
  });
});
