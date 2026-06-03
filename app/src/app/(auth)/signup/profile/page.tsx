"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Lock, X } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { ProgressBar } from "@/app/components/ui/ProgressBar";
import { SIGNUP_TEMP_KEY } from "@/app/(auth)/signup/page";

/** ステップ数に基づくプログレスバー値 */
const STEP2_PROGRESS = Math.round((2 / 3) * 100);

interface SignupTemp {
  email: string;
}

export default function SignupProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupData, setSignupData] = useState<SignupTemp | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(SIGNUP_TEMP_KEY);
    if (!raw) {
      // Step 1 を経由していない場合は最初のステップへ戻す
      router.replace("/signup");
      return;
    }
    try {
      setSignupData(JSON.parse(raw) as SignupTemp);
    } catch {
      // データ破損時も Step 1 へ戻す
      router.replace("/signup");
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!signupData) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: signupData.email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        let msg = error.message;
        if (msg.includes("Password should be at least 6 characters")) {
          msg = "パスワードは6文字以上で入力してください";
        } else if (msg.includes("User already registered")) {
          msg = "このメールアドレスは既に登録されています";
        } else if (msg.includes("Database error saving new user")) {
          msg = "データベース保存エラー: DBトリガー等を確認してください";
        }
        setError(msg);
        return;
      }

      // 一時データを削除
      sessionStorage.removeItem(SIGNUP_TEMP_KEY);

      if (data?.session) {
        // メール確認不要の場合: セッション確立済み → フルリロードでホームへ
        window.location.href = "/";
      } else {
        // メール確認が必要な場合: 確認メール送信済みページへ
        router.push("/signup/complete");
      }
    } catch (err) {
      console.error("Signup profile error:", err);
      setError("登録中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="relative w-full max-w-[640px]">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex w-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight text-text-dark">
                詳細情報の入力
              </h1>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-text-body hover:bg-tab-bg hover:text-text-dark"
                aria-label="閉じる"
              >
                <X className="size-5" />
              </button>
            </div>
            <ProgressBar value={STEP2_PROGRESS} />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="お名前"
              icon={User}
              type="text"
              placeholder="山田 太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
            <Input
              label="パスワード"
              icon={Lock}
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showPasswordToggle
              required
              minLength={6}
              autoComplete="new-password"
            />

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
                disabled={loading}
              >
                戻る
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "登録中..." : "登録する"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
