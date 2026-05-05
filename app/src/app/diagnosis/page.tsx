import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/Header";
import { DiagnosisWizard } from "./components/DiagnosisWizard";
import { DEFAULT_DIAGNOSIS_MODE, isDiagnosisMode } from "@/lib/personality/constants";

type DiagnosisPageProps = {
  searchParams?: Promise<{
    mode?: string | string[];
  }>;
};

/**
 * 診断ページ（/diagnosis）
 *
 * アクセス条件:
 * - ログイン済み（未ログイン → /login へリダイレクト）
 * - ロール = participant のみ（参加者レコードが存在すること）
 */
export default async function DiagnosisPage({ searchParams }: DiagnosisPageProps) {
  let user = null;
  const params = await searchParams;
  const modeParam = Array.isArray(params?.mode) ? params.mode[0] : params?.mode;
  const initialMode = isDiagnosisMode(modeParam) ? modeParam : DEFAULT_DIAGNOSIS_MODE;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("[DiagnosisPage] Supabase接続エラー:", err);
  }

  // 認証チェック（redirect は try/catch の外で呼び出す）
  if (!user) {
    redirect("/login");
  }

  // 参加者ロールチェック（proxy の user_metadata 検証と同じ基準を利用）
  const role = (user.user_metadata as Record<string, unknown>).role as string | undefined;
  if (role !== "participant") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <DiagnosisWizard initialMode={initialMode} />
      </main>
    </div>
  );
}
