import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/app/components/Header";
import { TrialDiagnosisClient } from "./components/TrialDiagnosisClient";

export default function TrialDiagnosisPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          トップに戻る
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-dark">
            簡易診断を試す
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-body">
            登録前に15問だけ回答して、活動スタイルの雰囲気を確認できます。
          </p>
        </div>
        <TrialDiagnosisClient />
      </main>
    </div>
  );
}
