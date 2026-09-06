import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";

const mocks = vi.hoisted(() => ({
  getViewerContext: vi.fn(),
  header: vi.fn(),
}));

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

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: mocks.getViewerContext,
}));

vi.mock("@/app/components/Header", () => ({
  Header: ({ viewerContext }: { viewerContext?: unknown }) => {
    mocks.header(viewerContext);
    return <header>ヘッダー</header>;
  },
}));

describe("NotFound", () => {
  const organizationViewer = {
    status: "authenticated" as const,
    identity: {
      id: "organization-user-1",
      email: "organization@example.com",
      displayName: "団体",
    },
    role: "organization" as const,
    isActive: true,
    hasParticipantProfile: false,
    hasOrganizationProfile: true,
    organizationVerified: true,
    organizationReviewStatus: "approved",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue(organizationViewer);
  });

  it("承認済み団体にはダッシュボードを主導線として表示する", async () => {
    render(await NotFound());

    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeDefined();
    expect(screen.getByText("ヘッダー")).toBeDefined();
    expect(
      screen.getByRole("link", { name: /ダッシュボードへ戻る/ }).getAttribute(
        "href",
      ),
    ).toBe("/dashboard");
    expect(
      screen.getByRole("link", { name: /トップへ戻る/ }).getAttribute("href"),
    ).toBe("/");
    expect(screen.queryByRole("link", { name: /診断を始める/ })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(mocks.getViewerContext).toHaveBeenCalledOnce();
    expect(mocks.header).toHaveBeenCalledWith(organizationViewer);
  });

  it("guestの主導線がトップへ戻る1本になる", async () => {
    const guestViewer = { status: "guest" as const };
    mocks.getViewerContext.mockResolvedValue(guestViewer);

    render(await NotFound());

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "トップへ戻る" }).getAttribute("href"),
    ).toBe("/");
    expect(screen.queryByRole("link", { name: /診断/ })).toBeNull();
    expect(mocks.header).toHaveBeenCalledWith(guestViewer);
  });

  it("ViewerContext errorでも404本文とアカウント確認の補足を表示する", async () => {
    const errorViewer = {
      status: "error" as const,
      errorCode: "account_lookup_failed" as const,
    };
    mocks.getViewerContext.mockResolvedValue(errorViewer);

    render(await NotFound());

    expect(screen.getByRole("heading", { name: "ページが見つかりません" })).toBeDefined();
    expect(
      screen.getByText(
        "アカウント情報を確認できないため、トップページから再度お試しください。",
      ),
    ).toBeDefined();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /診断/ })).toBeNull();
    expect(mocks.header).toHaveBeenCalledWith(errorViewer);
  });

});
