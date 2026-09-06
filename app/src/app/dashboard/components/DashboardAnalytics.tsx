import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import type {
  DashboardAnalyticsResult,
  OpportunityAnalytics,
} from "@/lib/dashboard/types";
import AnalyticsRetryButton from "./AnalyticsRetryButton";

const ANALYTICS_HEADING_ID = "dashboard-analytics-heading";

function shortAnalyticsTitle(title: string): string {
  return title.length > 10 ? `${title.slice(0, 10)}...` : title;
}

function AnalyticsSummary({
  analytics,
}: {
  analytics: Extract<DashboardAnalyticsResult, { success: true }>;
}) {
  const totalViews = analytics.opportunities.reduce(
    (sum, item) => sum + item.viewCount,
    0,
  );
  const totalApplications = analytics.opportunities.reduce(
    (sum, item) => sum + item.applicationCount,
    0,
  );
  const averageApprovalRate =
    analytics.opportunities.length > 0
      ? `${Math.round(
          analytics.opportunities.reduce(
            (sum, item) => sum + item.approvalRate,
            0,
          ) / analytics.opportunities.length,
        )}%`
      : "0%";

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-lg bg-background px-4 py-3">
        <p className="text-xs text-text-body">閲覧数</p>
        <p className="mt-1 text-2xl font-bold text-text-dark">{totalViews}</p>
      </div>
      <div className="rounded-lg bg-background px-4 py-3">
        <p className="text-xs text-text-body">応募数</p>
        <p className="mt-1 text-2xl font-bold text-text-dark">
          {totalApplications}
        </p>
      </div>
      <div className="rounded-lg bg-background px-4 py-3">
        <p className="text-xs text-text-body">承認率</p>
        <p className="mt-1 text-2xl font-bold text-text-dark">
          {averageApprovalRate}
        </p>
      </div>
      <div className="rounded-lg bg-background px-4 py-3">
        <p className="text-xs text-text-body">アプローチ承諾率</p>
        <p className="mt-1 text-2xl font-bold text-text-dark">
          {analytics.approaches.acceptanceRate}%
        </p>
      </div>
    </div>
  );
}

function OpportunityAnalyticsTable({
  opportunities,
}: {
  opportunities: OpportunityAnalytics[];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs text-text-body">
          <tr>
            <th className="py-2 pr-3 font-medium">案件</th>
            <th className="py-2 pr-3 font-medium">閲覧</th>
            <th className="py-2 pr-3 font-medium">応募</th>
            <th className="py-2 pr-3 font-medium">承認率</th>
            <th className="py-2 pr-3 font-medium">完了</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.slice(0, 5).map((item) => (
            <tr key={item.opportunityId} className="border-t border-card-border">
              <td className="py-2 pr-3 font-medium text-text-dark">
                {shortAnalyticsTitle(item.title)}
              </td>
              <td className="py-2 pr-3 text-text-body">{item.viewCount}</td>
              <td className="py-2 pr-3 text-text-body">
                {item.applicationCount}
              </td>
              <td className="py-2 pr-3 text-text-body">
                {item.approvalRate}%
              </td>
              <td className="py-2 pr-3 text-text-body">
                {item.completedCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardAnalytics({
  analytics,
}: {
  analytics: DashboardAnalyticsResult;
}) {
  return (
    <Card className="mb-6" aria-labelledby={ANALYTICS_HEADING_ID}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="size-5 text-primary" />
          </div>
          <h2
            id={ANALYTICS_HEADING_ID}
            tabIndex={-1}
            className="text-lg font-bold text-text-dark"
          >
            分析
          </h2>
        </div>
      </CardHeader>
      <CardContent>
        {analytics.success ? (
          <>
            <AnalyticsSummary analytics={analytics} />
            {analytics.opportunities.length > 0 ? (
              <OpportunityAnalyticsTable opportunities={analytics.opportunities} />
            ) : (
              <p className="text-sm text-text-body">
                集計対象の募集案件はありません
              </p>
            )}
          </>
        ) : (
          <div
            role="alert"
            className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
          >
            分析データを取得できませんでした。時間をおいて再試行してください。
          </div>
        )}
        <AnalyticsRetryButton
          isSuccessful={analytics.success}
          headingId={ANALYTICS_HEADING_ID}
        />
      </CardContent>
    </Card>
  );
}
