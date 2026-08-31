import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { delayDiagnosisForE2E } from "@/lib/e2e/diagnosis-delay";
import { Header } from "@/app/components/Header";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { DiagnosisWizard } from "./components/DiagnosisWizard";

/**
 * 診断ページ（/diagnosis）
 *
 * アクセス条件:
 * - ログイン済み（未ログイン → /login へリダイレクト）
 * - ロール = participant のみ（参加者レコードが存在すること）
 */
export default async function DiagnosisPage() {
  await delayDiagnosisForE2E(await headers());

  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive) {
    redirect("/auth/signout?reason=suspended");
  }
  if (viewer.role !== "participant" || !viewer.hasParticipantProfile) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <DiagnosisWizard />
      </main>
    </div>
  );
}
