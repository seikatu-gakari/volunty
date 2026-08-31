import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileCheck2,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { requireApprovedOrganizationViewer } from "@/lib/auth/page-viewer";
import { fetchDashboardCertificateDetailQuery } from "@/lib/certificates/queries";
import type { CertificateStatus } from "@/lib/certificates/types";
import { CertificateReviewActions } from "./CertificateReviewActions";

export const dynamic = "force-dynamic";

function statusDisplay(status: CertificateStatus) {
  switch (status) {
    case "issued":
      return {
        label: "発行済み",
        icon: <CheckCircle2 className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "rejected":
      return {
        label: "却下",
        icon: <XCircle className="size-4" />,
        color: "text-red-700 bg-red-50 border-red-200",
      };
    default:
      return {
        label: "申請中",
        icon: <Clock className="size-4" />,
        color: "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
  }
}

export default async function DashboardCertificateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = requireApprovedOrganizationViewer(await getViewerContext());
  const { certificate, error } = await fetchDashboardCertificateDetailQuery(
    viewer.identity.id,
    id
  );

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "団体プロフィールが見つかりません") {
    redirect("/onboarding/organization");
  }
  if (error === "承認済み団体のみ利用できます") {
    redirect("/onboarding/pending");
  }

  if (!certificate) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Header viewerContext={viewer} />
        <main className="mx-auto max-w-3xl px-6 py-8">
          <Link
            href="/dashboard/certificates"
            className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" />
            証明書発行管理に戻る
          </Link>
          <Card>
            <CardContent>
              <p className="text-sm text-text-body">
                {error ?? "証明書申請が見つかりません。"}
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const display = statusDisplay(certificate.status);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/dashboard/certificates"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          証明書発行管理に戻る
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <FileCheck2 className="size-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text-dark">
                    {certificate.opportunityTitle}
                  </h1>
                  <p className="mt-1 text-sm text-text-body">
                    {certificate.participantName}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${display.color}`}
              >
                {display.icon}
                {display.label}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                <dt className="text-text-body">参加者</dt>
                <dd className="font-medium text-text-dark">{certificate.participantName}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                <dt className="text-text-body">活動日</dt>
                <dd className="font-medium text-text-dark">{certificate.activityDateLabel}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                <dt className="text-text-body">申請日</dt>
                <dd className="font-medium text-text-dark">
                  {new Date(certificate.requestedAt).toLocaleDateString("ja-JP")}
                </dd>
              </div>
              {certificate.certificateNumber && (
                <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                  <dt className="text-text-body">証明書番号</dt>
                  <dd className="font-medium text-text-dark">
                    {certificate.certificateNumber}
                  </dd>
                </div>
              )}
            </dl>

            {certificate.rejectionReason && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
                却下理由: {certificate.rejectionReason}
              </div>
            )}

            {certificate.status === "pending" && (
              <CertificateReviewActions certificateId={certificate.id} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
