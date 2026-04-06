"use client";

import { useState } from "react";
import { Users, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { setUserRole } from "@/lib/onboarding/actions";

/**
 * ロール選択UI — 参加者 or 団体を選択してオンボーディングを開始する。
 */
export function RoleSelectView() {
  const [loading, setLoading] = useState<"participant" | "organization" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleSelectRole = async (role: "participant" | "organization") => {
    setLoading(role);
    setError(null);

    try {
      const result = await setUserRole(role);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-text-dark">
          ご登録タイプの選択
        </h1>
        <p className="mt-2 text-sm text-text-body">
          あなたはどちらとしてVoluntyを利用しますか？
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 参加者カード */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-text-dark">参加者</h2>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="flex-1 text-center text-sm text-text-body">
              ボランティア活動に参加したい方。性格診断を受けてあなたにぴったりの活動を見つけましょう。
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => handleSelectRole("participant")}
              disabled={loading !== null}
            >
              {loading === "participant" ? "設定中..." : "参加者として登録"}
            </Button>
          </CardContent>
        </Card>

        {/* 団体カード */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-text-dark">団体</h2>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="flex-1 text-center text-sm text-text-body">
              ボランティアを募集したい団体・NPO向け。活動案件を掲載して参加者を募りましょう。
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => handleSelectRole("organization")}
              disabled={loading !== null}
            >
              {loading === "organization" ? "設定中..." : "団体として登録"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-600">{error}</p>
      )}
    </main>
  );
}
