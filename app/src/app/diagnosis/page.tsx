import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  // 認証チェック
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (!user) {
      redirect("/login");
    }

    // 参加者ロールチェック
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!participant) {
      redirect("/");
    }
  } catch (err) {
    // redirect() は内部で例外をスローするため、それ以外のエラーのみ処理
    if (
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" ||
        "digest" in err)
    ) {
      throw err;
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[DiagnosisPage] エラー:", err);
    }
    redirect("/login");
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
