"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/app/components/ui/Card";
import { ProgressBar } from "@/app/components/ui/ProgressBar";
import { GoogleAuthButton } from "@/app/components/auth/GoogleAuthButton";
import { AuthFooter } from "@/app/components/auth/AuthFooter";
import { LegalLinks } from "@/app/components/legal/LegalLinks";
import { prepareSignupConsent } from "@/lib/legal/consent-actions";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_VERSIONS,
} from "@/lib/legal/documents";

export default function SignupPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // メール認証を再開する場合は、useState/FormEvent とメール登録フォームを戻す。
  // const [email, setEmail] = useState("");
  // const [error, setError] = useState<string | null>(null);
  // const [loading, setLoading] = useState(false);

  const handleGoogleSignup = async () => {
    setError(null);
    if (!agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    startTransition(async () => {
      const consentResult = await prepareSignupConsent();
      if (!consentResult.success) {
        setError(consentResult.error);
        return;
      }

      const supabase = createClient();
      const origin = location.origin.replace("//0.0.0.0:", "//localhost:");
      // 認証後は proxy が role 未設定を検知して /onboarding/role へ誘導する
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (oauthError) {
        setError("Google登録を開始できませんでした。時間をおいて再度お試しください。");
      }
    });
  };

  // const handleNext = (e: FormEvent) => {
  //   e.preventDefault();
  //   setError(null);
  //   setLoading(true);
  //
  //   try {
  //     // メールアドレスのみ一時保存（パスワード・名前は次のステップで入力）
  //     sessionStorage.setItem(SIGNUP_TEMP_KEY, JSON.stringify({ email }));
  //     router.push("/signup/profile");
  //   } catch {
  //     setError("ページ遷移中にエラーが発生しました");
  //     setLoading(false);
  //   }
  // };

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
          <div className="mb-5 rounded-lg border border-card-border bg-background p-4">
            <label className="flex items-start gap-3 text-sm leading-6 text-text-body">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                disabled={isPending}
                className="mt-1 size-4 shrink-0 accent-primary"
                aria-describedby="signup-consent-note"
              />
              <span>
                登録により、
                <Link href={LEGAL_DOCUMENTS.terms.href} className="mx-1 font-medium text-primary hover:underline">
                  利用規約
                </Link>
                （版 {LEGAL_DOCUMENT_VERSIONS.terms}）と
                <Link href={LEGAL_DOCUMENTS.privacy.href} className="mx-1 font-medium text-primary hover:underline">
                  プライバシーポリシー
                </Link>
                （版 {LEGAL_DOCUMENT_VERSIONS.privacy}）に同意します。
              </span>
            </label>
            <p id="signup-consent-note" className="mt-3 text-xs leading-5 text-text-body">
              Googleから受け取るアカウント情報、診断への回答・結果、応募や活動の記録を、サービス提供と安全運用のために取り扱います。
              保存・削除・問い合わせ方法は各文書で確認できます。
            </p>
          </div>

          <GoogleAuthButton
            label="Googleで登録"
            onClick={handleGoogleSignup}
            disabled={!agreed || isPending}
          />

          {error && (
            <p role="alert" className="mt-3 text-center text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 border-t border-card-border pt-5">
            <LegalLinks />
          </div>

          {/*
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
          */}

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
