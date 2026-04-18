"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  User,
  Mail,
  MapPin,
  Globe,
  FileText,
  Tag,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import type { PendingOrganization } from "@/lib/admin/actions";
import {
  approveOrganization,
  rejectOrganization,
} from "@/lib/admin/actions";

interface Props {
  organizations: PendingOrganization[];
}

type FilterTab = "pending" | "approved" | "rejected" | "all";

export function OrganizationReviewList({ organizations: initial }: Props) {
  const [organizations, setOrganizations] =
    useState<PendingOrganization[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<FilterTab>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string | null>>({});

  const filtered = organizations.filter((org) => {
    if (activeTab === "pending") return org.reviewStatus === "pending";
    if (activeTab === "approved") return org.reviewStatus === "approved";
    if (activeTab === "rejected") return org.reviewStatus === "rejected";
    return true;
  });

  const pendingCount = organizations.filter((o) => o.reviewStatus === "pending").length;
  const approvedCount = organizations.filter((o) => o.reviewStatus === "approved").length;
  const rejectedCount = organizations.filter((o) => o.reviewStatus === "rejected").length;

  const handleApprove = (orgId: string) => {
    startTransition(async () => {
      setFeedback((prev) => ({ ...prev, [orgId]: null }));
      const result = await approveOrganization(orgId);
      if (result.success) {
        setOrganizations((prev) =>
          prev.map((org) =>
            org.id === orgId
              ? {
                  ...org,
                  verified: true,
                  reviewStatus: "approved",
                  reviewComment: null,
                  reviewedAt: new Date().toISOString(),
                }
              : org
          )
        );
      } else {
        setFeedback((prev) => ({
          ...prev,
          [orgId]: result.error ?? "承認に失敗しました",
        }));
      }
    });
  };

  const handleReject = (orgId: string) => {
    startTransition(async () => {
      setFeedback((prev) => ({ ...prev, [orgId]: null }));
      const result = await rejectOrganization(orgId, reviewComments[orgId] ?? "");
      if (result.success) {
        setOrganizations((prev) =>
          prev.map((org) =>
            org.id === orgId
              ? {
                  ...org,
                  verified: false,
                  reviewStatus: "rejected",
                  reviewComment: (reviewComments[orgId] ?? "").trim(),
                  reviewedAt: new Date().toISOString(),
                }
              : org
          )
        );
      } else {
        setFeedback((prev) => ({
          ...prev,
          [orgId]: result.error ?? "否認に失敗しました",
        }));
      }
    });
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "pending", label: "審査待ち", count: pendingCount },
    { key: "approved", label: "承認済み", count: approvedCount },
    { key: "rejected", label: "否認済み", count: rejectedCount },
    { key: "all", label: "すべて", count: organizations.length },
  ];

  function getStatusView(status: PendingOrganization["reviewStatus"]) {
    switch (status) {
      case "approved":
        return {
          icon: CheckCircle2,
          label: "承認済み",
          chipClass: "border-green-200 bg-green-50 text-green-700",
          iconClass: "text-green-600",
          avatarClass: "bg-green-50",
        };
      case "rejected":
        return {
          icon: AlertCircle,
          label: "否認済み",
          chipClass: "border-red-200 bg-red-50 text-red-700",
          iconClass: "text-red-600",
          avatarClass: "bg-red-50",
        };
      default:
        return {
          icon: XCircle,
          label: "審査待ち",
          chipClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
          iconClass: "text-yellow-600",
          avatarClass: "bg-yellow-50",
        };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* フィルタータブ */}
      <div className="flex gap-2 rounded-lg bg-tab-bg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-text-dark shadow-sm"
                : "text-text-body hover:text-text-dark"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                activeTab === tab.key
                  ? "bg-primary/10 text-primary"
                  : "bg-white/60 text-text-body"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 団体リスト */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Building2 className="size-10 text-text-body/30" />
          <p className="text-sm text-text-body">
            {activeTab === "pending"
              ? "審査待ちの団体はありません"
              : activeTab === "approved"
                ? "承認済みの団体はありません"
                : activeTab === "rejected"
                  ? "否認済みの団体はありません"
                : "登録された団体はありません"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((org) => {
            const isExpanded = expandedId === org.id;
            const statusView = getStatusView(org.reviewStatus);
            const StatusIcon = statusView.icon;
            return (
              <Card key={org.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-10 items-center justify-center rounded-full ${statusView.avatarClass}`}>
                        <Building2
                          className={`size-5 ${statusView.iconClass}`}
                        />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-text-dark">
                          {org.organizationName}
                        </h3>
                        <p className="text-xs text-text-body">
                          申請日:{" "}
                          {new Date(org.createdAt).toLocaleDateString("ja-JP")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusView.chipClass}`}
                    >
                      <>
                        <StatusIcon className="size-3.5" /> {statusView.label}
                      </>
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* 基本情報 */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {org.representativeName && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="size-4 shrink-0 text-text-body/60" />
                        <span className="text-text-body">代表者:</span>
                        <span className="font-medium text-text-dark">
                          {org.representativeName}
                        </span>
                      </div>
                    )}
                    {org.contactEmail && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="size-4 shrink-0 text-text-body/60" />
                        <span className="text-text-body">連絡先:</span>
                        <span className="font-medium text-text-dark">
                          {org.contactEmail}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <BarChart3 className="size-4 shrink-0 text-text-body/60" />
                      <span className="text-text-body">充実度:</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${org.profileCompleteness}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-text-dark">
                          {org.profileCompleteness}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 詳細トグル */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : org.id)
                    }
                    className="cursor-pointer text-sm font-medium text-primary hover:underline"
                  >
                    {isExpanded ? "詳細を閉じる" : "詳細を表示"}
                  </button>

                  {/* 展開時の詳細 */}
                  {isExpanded && (
                    <div className="flex flex-col gap-3 rounded-lg border border-card-border bg-background p-4">
                      {org.reviewComment && (
                        <div className="rounded-lg border border-red-100 bg-red-50/80 p-3 text-sm text-red-800">
                          <p className="font-medium">否認理由</p>
                          <p className="mt-1 whitespace-pre-wrap">{org.reviewComment}</p>
                        </div>
                      )}
                      {org.activityAreas.length > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                          <div>
                            <span className="text-text-body">活動地域:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {org.activityAreas.map((area) => (
                                <span
                                  key={area}
                                  className="rounded-full border border-card-border bg-white px-2 py-0.5 text-xs text-text-body"
                                >
                                  {area}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {org.activityCategories.length > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <Tag className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                          <div>
                            <span className="text-text-body">活動分野:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {org.activityCategories.map((cat) => (
                                <span
                                  key={cat}
                                  className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {org.description && (
                        <div className="flex items-start gap-2 text-sm">
                          <FileText className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                          <div>
                            <span className="text-text-body">団体説明:</span>
                            <p className="mt-1 whitespace-pre-wrap text-text-dark">
                              {org.description}
                            </p>
                          </div>
                        </div>
                      )}
                      {org.websiteUrl && (
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="size-4 shrink-0 text-text-body/60" />
                          <span className="text-text-body">
                            Web:
                          </span>
                          <a
                            href={org.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {org.websiteUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {org.reviewStatus === "pending" && (
                    <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-background p-4">
                      <label
                        htmlFor={`review-comment-${org.id}`}
                        className="text-sm font-medium text-text-dark"
                      >
                        否認理由
                      </label>
                      <textarea
                        id={`review-comment-${org.id}`}
                        value={reviewComments[org.id] ?? ""}
                        onChange={(event) =>
                          setReviewComments((prev) => ({
                            ...prev,
                            [org.id]: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="否認する場合は理由を入力してください"
                        className="w-full rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  )}

                  {feedback[org.id] && (
                    <p className="text-sm text-red-700">{feedback[org.id]}</p>
                  )}

                  {/* アクションボタン */}
                  <div className="flex gap-3">
                    {org.reviewStatus === "pending" ? (
                      <>
                        <Button
                          onClick={() => handleApprove(org.id)}
                          disabled={isPending}
                          icon={CheckCircle2}
                          className="flex-1"
                        >
                          {isPending ? "処理中..." : "承認する"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(org.id)}
                          disabled={isPending}
                          icon={AlertCircle}
                          className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                        >
                          {isPending ? "処理中..." : "否認する"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        disabled
                        icon={StatusIcon}
                        className="flex-1"
                      >
                        {statusView.label}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
