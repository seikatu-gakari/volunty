"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  Globe,
  Mail,
  MapPin,
  Tag,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import type { PendingOrganization } from "@/lib/admin/actions";
import {
  approveOrganization,
  rejectOrganization,
} from "@/lib/admin/actions";

interface Props {
  organization: PendingOrganization;
}

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

export function OrganizationReviewDetail({ organization }: Props) {
  const router = useRouter();
  const [reviewComment, setReviewComment] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const statusView = getStatusView(organization.reviewStatus);
  const StatusIcon = statusView.icon;
  const isReviewable = organization.reviewStatus === "pending";
  const normalizedComment = reviewComment.trim();

  const handleApprove = () => {
    startTransition(async () => {
      setFeedback(null);
      const result = await approveOrganization(organization.id);
      if (result.success) {
        router.push("/admin/reviews");
        return;
      }

      setFeedback(result.error ?? "承認に失敗しました");
    });
  };

  const handleReject = () => {
    if (!normalizedComment) {
      setFeedback("否認理由を入力してください");
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await rejectOrganization(
        organization.id,
        normalizedComment
      );
      if (result.success) {
        router.push("/admin/reviews");
        return;
      }

      setFeedback(result.error ?? "否認に失敗しました");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-12 items-center justify-center rounded-full ${statusView.avatarClass}`}
              >
                <Building2 className={`size-6 ${statusView.iconClass}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-dark">
                  {organization.organizationName}
                </h2>
                <p className="text-xs text-text-body">
                  申請日:{" "}
                  {new Date(organization.createdAt).toLocaleDateString(
                    "ja-JP"
                  )}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusView.chipClass}`}
            >
              <StatusIcon className="size-3.5" />
              {statusView.label}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {organization.representativeName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 shrink-0 text-text-body/60" />
                <span className="text-text-body">代表者:</span>
                <span className="font-medium text-text-dark">
                  {organization.representativeName}
                </span>
              </div>
            )}
            {organization.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-4 shrink-0 text-text-body/60" />
                <span className="text-text-body">連絡先:</span>
                <span className="font-medium text-text-dark">
                  {organization.contactEmail}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <BarChart3 className="size-4 shrink-0 text-text-body/60" />
              <span className="text-text-body">充実度:</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${organization.profileCompleteness}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-text-dark">
                  {organization.profileCompleteness}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-card-border bg-background p-4">
            {organization.reviewComment && (
              <div className="rounded-lg border border-red-100 bg-red-50/80 p-3 text-sm text-red-800">
                <p className="font-medium">否認理由</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {organization.reviewComment}
                </p>
              </div>
            )}
            {organization.activityAreas.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                <div>
                  <span className="text-text-body">活動地域:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {organization.activityAreas.map((area) => (
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
            {organization.activityCategories.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Tag className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                <div>
                  <span className="text-text-body">活動分野:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {organization.activityCategories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {organization.description && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                <div>
                  <span className="text-text-body">団体説明:</span>
                  <p className="mt-1 whitespace-pre-wrap leading-6 text-text-dark">
                    {organization.description}
                  </p>
                </div>
              </div>
            )}
            {organization.websiteUrl && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="size-4 shrink-0 text-text-body/60" />
                <span className="text-text-body">Web:</span>
                <a
                  href={organization.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {organization.websiteUrl}
                </a>
              </div>
            )}
            {organization.reviewedAt && (
              <p className="text-xs text-text-body">
                審査日:{" "}
                {new Date(organization.reviewedAt).toLocaleDateString("ja-JP")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-text-dark">審査操作</h2>
        </CardHeader>
        <CardContent>
          {isReviewable ? (
            <>
              <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-background p-4">
                <label
                  htmlFor={`review-comment-${organization.id}`}
                  className="text-sm font-medium text-text-dark"
                >
                  却下理由
                </label>
                <textarea
                  id={`review-comment-${organization.id}`}
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={4}
                  placeholder="否認する場合は理由を入力してください"
                  className="w-full rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {feedback && <p className="text-sm text-red-700">{feedback}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={handleApprove}
                  disabled={isPending}
                  icon={CheckCircle2}
                  className="flex-1"
                >
                  {isPending ? "処理中..." : "承認する"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isPending || !normalizedComment}
                  icon={AlertCircle}
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                >
                  {isPending ? "処理中..." : "否認する"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {feedback && <p className="text-sm text-red-700">{feedback}</p>}
              <Button
                variant="outline"
                disabled
                icon={StatusIcon}
                className="w-full"
              >
                {statusView.label}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
