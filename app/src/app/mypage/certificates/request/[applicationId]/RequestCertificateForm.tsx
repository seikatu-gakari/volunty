"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, FileCheck2, Loader2 } from "lucide-react";
import { requestCertificate } from "@/lib/certificates/actions";

export function RequestCertificateForm({
  applicationId,
}: {
  applicationId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    certificateId?: string;
    error?: string;
  } | null>(null);

  function handleRequest() {
    setResult(null);
    startTransition(async () => {
      const response = await requestCertificate(applicationId);
      setResult(response);
    });
  }

  if (result?.success && result.certificateId) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-green-50 p-6 text-center">
        <CheckCircle2 className="size-10 text-green-700" />
        <div>
          <p className="text-sm font-medium text-green-800">
            証明書申請を送信しました
          </p>
          <p className="mt-1 text-xs text-green-700">
            団体の承認後、証明書をダウンロードできます。
          </p>
        </div>
        <Link
          href={`/mypage/certificates/${result.certificateId}`}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          申請状況を見る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleRequest}
        disabled={isPending}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            申請中...
          </>
        ) : (
          <>
            <FileCheck2 className="size-4" />
            証明書を申請する
          </>
        )}
      </button>
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
    </div>
  );
}
