import Link from "next/link";
import { Plus, ClipboardList, Clock, Users, Lock, Unlock } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchMyOpportunities } from "@/lib/dashboard/actions";
import type { OpportunityStatus } from "@/lib/dashboard/types";

/** 案件ステータスに応じたラベル・アイコン・カラー */
function opportunityStatusDisplay(status: OpportunityStatus) {
  switch (status) {
    case "open":
      return {
        label: "募集中",
        icon: <Unlock className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "closed":
      return {
        label: "募集終了",
        icon: <Lock className="size-4" />,
        color: "text-gray-700 bg-gray-50 border-gray-200",
      };
  }
}

export default async function DashboardPage() {
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

  const { opportunities } = await fetchMyOpportunities();

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-dark">ダッシュボード</h1>
          <Link
            href="/dashboard/opportunities/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" />
            新しい案件を作成
          </Link>
        </div>

        {/* 案件一覧セクション */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <ClipboardList className="size-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-text-dark">募集案件一覧</h2>
            </div>
          </CardHeader>
          <CardContent>
            {opportunities.length > 0 ? (
              <div className="flex flex-col gap-4">
                {opportunities.map((opp) => {
                  const display = opportunityStatusDisplay(opp.status);
                  return (
                    <Link
                      key={opp.id}
                      href={`/dashboard/opportunities/${opp.id}`}
                      className="block rounded-lg border border-card-border p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-text-dark">
                            {opp.title}
                          </h3>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${display.color}`}
                          >
                            {display.icon}
                            {display.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-body">
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" />
                            応募者 {opp.application_count}件
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {new Date(opp.created_at).toLocaleDateString(
                              "ja-JP"
                            )}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <ClipboardList className="size-10 text-text-body/30" />
                <p className="text-sm text-text-body">
                  まだ募集案件がありません。
                </p>
                <Link
                  href="/dashboard/opportunities/new"
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="size-4" />
                  最初の案件を作成しましょう
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
