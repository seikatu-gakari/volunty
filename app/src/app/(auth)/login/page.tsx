"use client";

import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardContent } from "@/app/components/ui/Card";
import { GoogleAuthButton } from "@/app/components/auth/GoogleAuthButton";
import { AuthFooter } from "@/app/components/auth/AuthFooter";

export default function LoginPage() {
  // メール認証を再開する場合は、useState/FormEvent とメールログインフォームを戻す。
  // const [email, setEmail] = useState("");
  // const [password, setPassword] = useState("");
  // const [error, setError] = useState<string | null>(null);
  // const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    // 0.0.0.0 でアクセスした場合は localhost に補正（Supabase Redirect URLs との一致のため）
    const origin = location.origin.replace("//0.0.0.0:", "//localhost:");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
  };

  // const handleEmailLogin = async (e: FormEvent) => {
  //   e.preventDefault();
  //   setError(null);
  //   setLoading(true);
  //
  //   try {
  //     const supabase = createClient();
  //     const { error } = await supabase.auth.signInWithPassword({
  //       email,
  //       password,
  //     });
  //
  //     if (error) {
  //       setError("メールアドレスまたはパスワードが正しくありません");
  //       return;
  //     }
  //
  //     // ログイン成功 — ホームにリダイレクト
  //     window.location.href = "/";
  //   } catch {
  //     setError("ログイン中にエラーが発生しました");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold tracking-tight text-text-dark">
            ログイン
          </h1>
        </CardHeader>
        <CardContent>


          <GoogleAuthButton
            label="Googleでログイン"
            onClick={handleGoogleLogin}
          />

          {/*
          <Divider text="または" />

          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
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
            <Input
              label="パスワード"
              icon={Lock}
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showPasswordToggle
              required
              autoComplete="current-password"
            />

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
          */}

          <AuthFooter
            message="アカウントをお持ちでないですか？"
            linkText="新規登録はこちら"
            linkHref="/signup"
          />
        </CardContent>
      </Card>
    </div>
  );
}
