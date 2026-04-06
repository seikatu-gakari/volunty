import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Building2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/app/components/ui/Card";
import { fetchOnboardingStatus } from "@/lib/onboarding/actions";

export default async function RolePage() {
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

  // すでにロールが設定済みの場合はリダイレクト
  const status = await fetchOnboardingStatus();
  if (status.hasRole) {
    if (status.role === "participant") {
      if (status.hasProfile) {
        redirect("/");
      } else {
        redirect("/onboarding/participant");
      }
    }
    if (status.role === "organization") {
      if (!status.hasProfile) {
        redirect("/onboarding/organization");
      } else if (status.organizationStatus !== "approved") {
        redirect("/onboarding/pending");
      } else {
        redirect("/");
      }
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-text-dark">
            ようこそ！あなたの登録タイプを選択してください
          </h1>
          <p className="text-sm text-text-body">
            参加者として活動に応募するか、団体として募集案件を作成するかを選択してください。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 参加者カード */}
          <Link href="/onboarding/participant" className="group block">
            <Card className="flex h-full flex-col gap-4 p-6 transition-shadow hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="size-6 text-primary" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-text-dark">参加者</h2>
                <p className="text-sm text-text-body">
                  性格診断を受けて、あなたにぴったりのボランティア活動を見つけましょう。
                </p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                参加者として登録する
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>

          {/* 団体カード */}
          <Link href="/onboarding/organization" className="group block">
            <Card className="flex h-full flex-col gap-4 p-6 transition-shadow hover:shadow-md">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="size-6 text-primary" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-text-dark">団体</h2>
                <p className="text-sm text-text-body">
                  ボランティア募集案件を作成して、あなたの活動に合った参加者とつながりましょう。
                </p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                団体として登録する
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
