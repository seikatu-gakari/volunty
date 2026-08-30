import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { delayDiagnosisForE2E } from "@/lib/e2e/diagnosis-delay";
import { Header } from "@/app/components/Header";
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

  let user = null;
  let role: unknown = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const { data: account } = await supabase
        .from("m_user")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      role = account?.role;
    }
  } catch (err) {
    console.error("[DiagnosisPage] Supabase接続エラー:", err);
  }

  // 認証チェック（redirect は try/catch の外で呼び出す）
  if (!user) {
    redirect("/login");
  }

  // 参加者ロールチェック（自己更新可能な metadata ではなく DB role を利用）
  if (role !== "participant") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <DiagnosisWizard />
      </main>
    </div>
  );
}
