import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardAnalyticsResult } from "@/lib/dashboard/types";
import DashboardAnalytics from "./DashboardAnalytics";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("DashboardAnalytics", () => {
  it("正常な0件は0指標と対象案件なしを表示し、表を表示しない", () => {
    const analytics: DashboardAnalyticsResult = {
      success: true,
      opportunities: [],
      approaches: {
        sentTotal: 0,
        acceptedCount: 0,
        acceptanceRate: 0,
        declinedCount: 0,
        pendingCount: 0,
      },
    };

    render(<DashboardAnalytics analytics={analytics} />);

    expect(screen.getByRole("heading", { name: "分析" })).toBeDefined();
    expect(screen.getByText("集計対象の募集案件はありません")).toBeDefined();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("案件がある正常結果は指標と案件別表を表示する", () => {
    const analytics: DashboardAnalyticsResult = {
      success: true,
      opportunities: [
        {
          opportunityId: "opp-1",
          title: "環境保全",
          viewCount: 3,
          applicationCount: 2,
          approvedCount: 1,
          approvalRate: 50,
          declinedCount: 0,
          completedCount: 0,
        },
      ],
      approaches: {
        sentTotal: 4,
        acceptedCount: 1,
        acceptanceRate: 25,
        declinedCount: 0,
        pendingCount: 3,
      },
    };

    render(<DashboardAnalytics analytics={analytics} />);

    expect(screen.getAllByText("閲覧数")).toHaveLength(1);
    expect(screen.getAllByText("応募数")).toHaveLength(1);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("環境保全")).toBeDefined();
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(1);
  });

  it("取得失敗時はエラー案内と再試行だけを表示し、0指標と表を表示しない", () => {
    const analytics: DashboardAnalyticsResult = {
      success: false,
      error: "予期しないエラーが発生しました",
    };

    render(<DashboardAnalytics analytics={analytics} />);

    expect(screen.getByRole("alert").textContent).toContain(
      "分析データを取得できませんでした。時間をおいて再試行してください。",
    );
    expect(screen.getByRole("button", { name: "分析を再試行" })).toBeDefined();
    expect(screen.queryByText("閲覧数")).toBeNull();
    expect(screen.queryByText("応募数")).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
