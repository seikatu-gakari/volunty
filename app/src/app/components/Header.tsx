import Image from "next/image";
import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { HeaderAuth } from "@/app/components/HeaderAuth";
import { PublicHeaderNavigation } from "@/app/components/PublicHeaderNavigation";
import { lpAssets } from "@/app/components/lp/lpAssets";

/** ユーザーのロール・オンボーディング状態 */
export interface HeaderUserState {
  role: "participant" | "organization" | null;
  onboardingCompleted: boolean;
  verified: boolean;
}

interface HeaderProps {
  variant?: "default" | "landing";
}

/** verified フラグまたは reviewStatus === "approved" でチェック */
function isOrganizationVerified(profile: {
  verified?: boolean | null;
  review_status?: string | null;
  reviewStatus?: string | null;
}): boolean {
  return (
    !!profile.verified ||
    profile.reviewStatus === "approved" ||
    profile.review_status === "approved"
  );
}

export async function Header({ variant = "default" }: HeaderProps = {}) {
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

      // role と onboardingCompleted は user_metadata から取得（Prisma 不要）
      userState = {
        role: role === "participant" || role === "organization" ? role : null,
        onboardingCompleted: !!metadata.onboarding_completed,
        verified: false,
      };

      // 団体の場合: verified / reviewStatus を取得
      if (role === "organization") {
        try {
          const orgProfile = await prisma.organizationProfile.findUnique({
            where: { userId: user.id },
            select: { verified: true, reviewStatus: true },
          });
          // verified フラグまたは reviewStatus === "approved" で判定
          userState.verified = isOrganizationVerified(orgProfile ?? {});
        } catch {
          // Prisma 失敗時は Supabase にフォールバック
          try {
            const { data: profile } = await supabase
              .from("m_organization_profile")
              .select("verified, review_status")
              .eq("user_id", user.id)
              .maybeSingle();
            userState.verified = isOrganizationVerified(profile ?? {});
          } catch {
            // DB 接続エラー時は verified: false のまま
          }
        }
      } else {
        userState.verified = !!metadata.verified;
      }
    }
  } catch {
    // Supabase未設定・接続エラー時はログインなしで表示
  }

  const showLandingHeader = variant === "landing" && !user;

  return (
    <header
      className={
        showLandingHeader
          ? "sticky top-0 z-50 border-b border-header-border bg-background/90 backdrop-blur-xl"
          : "sticky top-0 z-10 border-b border-header-border bg-background/60 backdrop-blur-sm"
      }
    >
      <div
        className={
          showLandingHeader
            ? "mx-auto flex h-[60px] max-w-7xl items-center justify-between px-3 sm:h-[72px] sm:px-6 lg:h-[84px] lg:px-0"
            : "mx-auto flex h-[77px] max-w-7xl items-center justify-between px-8 pt-4 pb-px"
        }
      >
        <Link
          href="/"
          className={
            showLandingHeader ? "flex items-center gap-2.5" : "flex items-center gap-2"
          }
          aria-label={showLandingHeader ? "ボランティー ホーム" : undefined}
        >
          {showLandingHeader ? (
            <Image
              src={lpAssets.brandMark.src}
              alt={lpAssets.brandMark.alt}
              width={lpAssets.brandMark.width}
              height={lpAssets.brandMark.height}
              className="size-9 object-contain sm:size-10"
            />
          ) : (
            <div className="relative">
              <Heart className="size-8 text-primary" fill="currentColor" strokeWidth={0} />
              <Sparkles className="absolute -top-1 -right-1 size-3.5 text-primary" />
            </div>
          )}
          <div className="flex flex-col">
            <span
              className={
                showLandingHeader
                  ? "text-base font-extrabold leading-6 text-primary-dark sm:text-xl sm:leading-7"
                  : "text-lg font-medium leading-7 text-text-dark"
              }
            >
              ボランティー
            </span>
            <span
              className={
                showLandingHeader
                  ? "block text-[10px] leading-3.5 text-text-body sm:text-xs sm:leading-4"
                  : "hidden text-xs leading-4 text-text-body sm:block"
              }
            >
              あなたにぴったりの活動を見つけよう
            </span>
          </div>
        </Link>
        {showLandingHeader && (
          <nav className="hidden items-center gap-1 lg:flex">
            {[
              { href: "#kadai", label: "はじめられない理由" },
              { href: "#usage", label: "使い方" },
              { href: "#types", label: "活動スタイル" },
              { href: "#faq", label: "よくある質問" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-body transition-colors hover:bg-primary/10 hover:text-text-dark"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        {showLandingHeader ? (
          <PublicHeaderNavigation />
        ) : (
          <HeaderAuth user={user} userState={userState} />
        )}
      </div>
    </header>
  );
}
