import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommonErrorDisplay } from "./CommonErrorDisplay";

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

describe("CommonErrorDisplay", () => {
  it("既定のエラーメッセージと復旧導線を表示する", () => {
    const onRetry = vi.fn();

    render(<CommonErrorDisplay onRetry={onRetry} digest="digest-123" />);

    expect(
      screen.getByRole("heading", { name: "ページを読み込めませんでした" })
    ).toBeDefined();
    expect(
      screen.getByText(
        "一時的な問題が発生した可能性があります。もう一度お試しください。"
      )
    ).toBeDefined();
    expect(screen.getByText("エラーID: digest-123")).toBeDefined();
    expect(
      screen.getByRole("link", { name: /トップへ戻る/ }).getAttribute("href")
    ).toBe("/");

    fireEvent.click(screen.getByRole("button", { name: /もう一度試す/ }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("retry関数がない場合は再試行ボタンを表示しない", () => {
    render(<CommonErrorDisplay />);

    expect(screen.queryByRole("button", { name: /もう一度試す/ })).toBeNull();
    expect(screen.getByRole("link", { name: /トップへ戻る/ })).toBeDefined();
  });
});
