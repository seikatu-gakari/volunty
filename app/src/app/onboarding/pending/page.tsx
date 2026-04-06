import { redirect } from "next/navigation";
import { Clock, Mail, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/app/components/ui/Card";
import { fetchOnboardingStatus } from "@/lib/onboarding/actions";

export default async function PendingPage() {
  // 認証チェック
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isAuthenticated = !!data.user;
  } catch {
    // Supabase 未設定時
  }

  if (!isAuthenticated) {
    redirect("/login");
  }

  // オンボーディング状態チェック
  const status = await fetchOnboardingStatus();

  // 参加者ロールのユーザーはホームへリダイレクト
  if (status.hasRole && status.role === "participant") {
    redirect("/");
  }

  // 団体ロールで未登録の場合はプロフィール登録へリダイレクト
  if (status.hasRole && status.role === "organization" && !status.hasProfile) {
    redirect("/onboarding/organization");
  }

  // 団体ロールで承認済みの場合はホームへリダイレクト
  if (
    status.hasRole &&
    status.role === "organization" &&
    status.organizationStatus === "approved"
  ) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">
        <Card>
          <CardContent className="items-center gap-8 py-10 text-center">
            {/* アイコン */}
            <div className="flex size-20 items-center justify-center rounded-full bg-yellow-50">
              <Clock className="size-10 text-yellow-500" />
            </div>

            {/* タイトル・説明 */}
            <div className="flex flex-col gap-3">
              <h1 className="text-xl font-bold text-text-dark">
                審査をお待ちください
              </h1>
              <p className="text-sm leading-relaxed text-text-body">
                団体登録申請を受け付けました。
                <br />
                管理者が内容を確認し、承認が完了するとご利用いただけます。
              </p>
            </div>

            {/* ステータス表示 */}
            <div className="w-full rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center gap-3">
                <Building2 className="size-5 shrink-0 text-yellow-600" />
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-xs font-medium text-yellow-700">
                    審査ステータス
                  </span>
                  <span className="text-sm font-bold text-yellow-800">
                    審査中
                  </span>
                </div>
              </div>
            </div>

            {/* 連絡先案内 */}
            <div className="flex items-start gap-2 rounded-lg bg-background px-4 py-3 text-left">
              <Mail className="mt-0.5 size-4 shrink-0 text-text-body" />
              <p className="text-xs leading-relaxed text-text-body">
                承認が完了した際はご登録のメールアドレスへご連絡いたします。
                ご不明な点はお問い合わせください。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
