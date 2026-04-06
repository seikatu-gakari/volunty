import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/Header";
import { RoleSelectView } from "./RoleSelectView";

/** users テーブルから取得するロール情報 */
type UserData = { role: unknown };

/**
 * /onboarding/role — ロール選択ページ
 *
 * アクセス条件:
 * - ログイン済み（未ログイン → /login へリダイレクト）
 * - ロール未選択（設定済み → 対応するオンボーディングページへリダイレクト）
 */
export default async function OnboardingRolePage() {
  let isAuthenticated = false;
  let existingRole: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    isAuthenticated = !!user;

    if (user) {
      // 既存ロールを確認
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const rawRole = (userData as UserData | null)?.role;
      existingRole = typeof rawRole === "string" ? rawRole : null;
    }
  } catch {
    // Supabase 未設定時はページを表示（開発環境対応）
  }

  if (!isAuthenticated) {
    redirect("/login");
  }

  if (existingRole === "participant") {
    redirect("/onboarding/participant");
  } else if (existingRole === "organization") {
    redirect("/onboarding/organization");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <RoleSelectView />
    </div>
  );
}
