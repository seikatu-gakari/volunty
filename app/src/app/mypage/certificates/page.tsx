import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchMyCertificates } from "@/lib/certificates/actions";
import type { CertificateStatus } from "@/lib/certificates/types";

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

export default async function MyCertificatesPage() {
  const { certificates, error } = await fetchMyCertificates();

  if (error === "ログインが必要です") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/mypage"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          マイページに戻る
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-dark">参加証明書</h1>
          <p className="mt-2 text-sm text-text-body">
            申請状況と発行済み証明書を確認できます。
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-card-border bg-white p-4 text-sm text-text-body">
            {error}
          </div>
        )}

        {certificates.length > 0 ? (
          <div className="space-y-4">
            {certificates.map((certificate) => {
              const display = statusDisplay(certificate.status);
              return (
                <Link
                  key={certificate.id}
                  href={`/mypage/certificates/${certificate.id}`}
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-base font-bold text-text-dark">
                            {certificate.opportunityTitle}
                          </h2>
                          <p className="mt-1 text-sm text-text-body">
                            {certificate.organizationName}
                          </p>
                        </div>
                        <span
                          className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${display.color}`}
                        >
                          {display.icon}
                          {display.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-text-body">
                        <span>活動日: {certificate.activityDateLabel}</span>
                        <span>
                          申請日:{" "}
                          {new Date(certificate.requestedAt).toLocaleDateString("ja-JP")}
                        </span>
                        {certificate.certificateNumber && (
                          <span>番号: {certificate.certificateNumber}</span>
                        )}
                      </div>
                      {certificate.status === "issued" && (
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                          <Download className="size-4" />
                          ダウンロードできます
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <FileCheck2 className="size-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-text-dark">
                  証明書申請はまだありません
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                活動完了済みの応募から参加証明書を申請できます。
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
