import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HeaderAuth } from "@/app/components/HeaderAuth";

/** ユーザーのロール・オンボーディング状態 */
export interface HeaderUserState {
  role: "participant" | "organization" | null;
  onboardingCompleted: boolean;
  verified: boolean;
}

export async function Header() {
  let user = null;
  let userState: HeaderUserState = {
    role: null,
    onboardingCompleted: false,
    verified: false,
  };

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const metadata = user.user_metadata as Record<string, unknown>;
      const role = metadata.role as string | undefined;
      userState = {
        role: role === "participant" || role === "organization" ? role : null,
        onboardingCompleted: !!metadata.onboarding_completed,
        verified: !!metadata.verified,
      };
    }
  } catch {
    // Supabase未設定・接続エラー時はログインなしで表示
  }

  return (
    <header className="sticky top-0 z-10 border-b border-header-border bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex h-[77px] max-w-5xl items-center justify-between px-8 pt-4 pb-[1px]">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative">
            <Heart className="size-8 text-primary" fill="#fb5b01" strokeWidth={0} />
            <Sparkles className="absolute -top-1 -right-1 size-3.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-medium leading-7 text-text-dark">
              ボランティー
            </span>
            <span className="hidden text-xs leading-4 text-text-body sm:block">
              あなたにぴったりの活動を見つけよう
            </span>
          </div>
        </Link>
        <HeaderAuth user={user} userState={userState} />
      </div>
    </header>
  );
}
