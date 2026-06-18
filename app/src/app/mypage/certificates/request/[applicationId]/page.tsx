import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchCertificateRequestTarget } from "@/lib/certificates/actions";
import { RequestCertificateForm } from "./RequestCertificateForm";

export const dynamic = "force-dynamic";

export default async function CertificateRequestPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { target, error } = await fetchCertificateRequestTarget(applicationId);

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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <FileCheck2 className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-dark">
                  参加証明書の申請
                </h1>
                <p className="mt-1 text-sm text-text-body">
                  活動完了済みの応募から証明書を申請します。
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {target ? (
              <>
                <dl className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                    <dt className="text-text-body">参加者</dt>
                    <dd className="font-medium text-text-dark">{target.participantName}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                    <dt className="text-text-body">活動名</dt>
                    <dd className="font-medium text-text-dark">{target.opportunityTitle}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                    <dt className="text-text-body">団体</dt>
                    <dd className="font-medium text-text-dark">{target.organizationName}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-lg bg-background px-3 py-2">
                    <dt className="text-text-body">活動日</dt>
                    <dd className="font-medium text-text-dark">{target.activityDateLabel}</dd>
                  </div>
                </dl>

                {target.existingCertificate ? (
                  <Link
                    href={`/mypage/certificates/${target.existingCertificate.id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                  >
                    申請状況を見る
                  </Link>
                ) : (
                  <RequestCertificateForm applicationId={target.applicationId} />
                )}
              </>
            ) : (
              <p className="text-sm text-text-body">
                {error ?? "証明書申請対象の応募が見つかりません。"}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
