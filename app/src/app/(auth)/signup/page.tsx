"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, X } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Divider } from "@/app/components/ui/Divider";
import { ProgressBar } from "@/app/components/ui/ProgressBar";
import { GoogleAuthButton } from "@/app/components/auth/GoogleAuthButton";
import { AuthFooter } from "@/app/components/auth/AuthFooter";

/** Step 1 で一時保存するキー（メールアドレスのみ） */
export const SIGNUP_TEMP_KEY = "volunty_signup_temp";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignup = async () => {
    const supabase = createClient();
    const origin = location.origin.replace("//0.0.0.0:", "//localhost:");
    // 認証後は proxy が role 未設定を検知して /onboarding/role へ誘導する
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
  };

  const handleNext = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // メールアドレスのみ一時保存（パスワード・名前は次のステップで入力）
      sessionStorage.setItem(SIGNUP_TEMP_KEY, JSON.stringify({ email }));
      router.push("/signup/profile");
    } catch {
      setError("ページ遷移中にエラーが発生しました");
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
                新規登録
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
            <ProgressBar value={33} />
          </div>
        </CardHeader>
        <CardContent>
          <GoogleAuthButton
            label="Googleで登録"
            onClick={handleGoogleSignup}
          />

          <Divider text="または" />

          <form onSubmit={handleNext} className="flex flex-col gap-4">
            <Input
              label="メールアドレス"
              icon={Mail}
              type="email"
              placeholder="volunteer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "処理中..." : "次へ (詳細情報の入力)"}
            </Button>
          </form>

          <AuthFooter
            message="既にアカウントをお持ちですか？"
            linkText="ログインはこちら"
            linkHref="/login"
          />
        </CardContent>
      </Card>
    </div>
  );
}
