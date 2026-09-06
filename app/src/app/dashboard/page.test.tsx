import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  getViewerContext: vi.fn(),
  header: vi.fn(),
  organizationProfileFindUnique: vi.fn(),
  fetchMyOpportunities: vi.fn(),
  fetchDashboardAnalytics: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  useRouter: () => ({ refresh: vi.fn() }),
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mocks.getUser() },
  }),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: () => mocks.getViewerContext(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationProfile: {
      findUnique: (...args: unknown[]) =>
        mocks.organizationProfileFindUnique(...args),
    },
  },
}));

vi.mock("@/app/components/Header", () => ({
  Header: ({ viewerContext }: { viewerContext?: unknown }) => {
    mocks.header(viewerContext);
    return <header>ヘッダー</header>;
  },
}));

vi.mock("@/lib/dashboard/queries", () => ({
  fetchMyOpportunitiesQuery: (...args: unknown[]) =>
    mocks.fetchMyOpportunities(...args),
  fetchDashboardAnalyticsQuery: (...args: unknown[]) =>
    mocks.fetchDashboardAnalytics(...args),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
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
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "organization-user-1" } },
    });
    mocks.organizationProfileFindUnique.mockResolvedValue({
      organizationName: "テスト団体",
      reviewStatus: "approved",
      reviewedAt: null,
      profileCompleteness: 100,
    });
    mocks.fetchMyOpportunities.mockResolvedValue({ opportunities: [] });
    mocks.fetchDashboardAnalytics.mockResolvedValue({
      success: true,
      opportunities: [],
      approaches: {
        sentTotal: 0,
        acceptedCount: 0,
        acceptanceRate: 0,
        declinedCount: 0,
        pendingCount: 0,
      },
    });
  });

  it("organizationのPageとHeaderは同じViewerContextを共有し、旧getUserを再照会しない", async () => {
    render(await DashboardPage());

    expect(screen.getByRole("heading", { name: "ダッシュボード" })).toBeDefined();
    expect(screen.getByText("テスト団体")).toBeDefined();
    expect(mocks.getViewerContext).toHaveBeenCalledOnce();
    expect(mocks.header).toHaveBeenCalledWith(organizationViewer);
    expect(mocks.fetchMyOpportunities).toHaveBeenCalledWith(
      organizationViewer.identity.id
    );
    expect(mocks.fetchDashboardAnalytics).toHaveBeenCalledWith(
      organizationViewer.identity.id
    );
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("ViewerContext errorを未認証としてログインへは送らない", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "error",
      errorCode: "account_lookup_failed",
    });

    await expect(DashboardPage()).rejects.toThrow(
      "閲覧者情報を確認できませんでした"
    );

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("分析取得に失敗しても案件タイトル・編集・新規作成の導線を維持する", async () => {
    mocks.fetchMyOpportunities.mockResolvedValue({
      opportunities: [
        {
          id: "opp-1",
          title: "環境保全ボランティア",
          status: "published",
          created_at: "2026-01-15T00:00:00Z",
          application_count: 0,
        },
      ],
    });
    mocks.fetchDashboardAnalytics.mockResolvedValue({
      success: false,
      error: "予期しないエラーが発生しました",
    });

    render(await DashboardPage());

    expect(screen.getByRole("alert").textContent).toContain(
      "分析データを取得できませんでした。時間をおいて再試行してください。",
    );
    expect(screen.getByText("環境保全ボランティア")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "編集" }).getAttribute("href"),
    ).toBe("/dashboard/opportunities/opp-1/edit");
    expect(
      screen
        .getByRole("link", { name: "新しい案件を作成" })
        .getAttribute("href"),
    ).toBe("/dashboard/opportunities/new");
    expect(screen.queryByText("閲覧数")).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
  });
});
