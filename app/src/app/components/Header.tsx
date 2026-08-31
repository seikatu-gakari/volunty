import Image from "next/image";
import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import {
  getViewerContext,
  type ViewerContext,
} from "@/lib/auth/viewer-context";
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
  viewerContext?: ViewerContext;
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

export async function Header({ variant = "default", viewerContext }: HeaderProps = {}) {
  const viewer = viewerContext ?? (await getViewerContext());
  let userState: HeaderUserState = {
    role: null,
    onboardingCompleted: false,
    verified: false,
  };

  if (viewer.status === "authenticated" && viewer.isActive) {
    userState = {
      role:
        viewer.role === "participant" || viewer.role === "organization"
          ? viewer.role
          : null,
      onboardingCompleted:
        (viewer.role === "participant" && viewer.hasParticipantProfile) ||
        (viewer.role === "organization" && viewer.hasOrganizationProfile),
      verified: isOrganizationVerified({
        verified: viewer.organizationVerified,
        review_status: viewer.organizationReviewStatus,
      }),
    };
  }

  const identity = viewer.status === "authenticated" ? viewer.identity : null;
  const showLandingHeader = variant === "landing" && !identity;

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
          aria-label={showLandingHeader ? "ボランティ ホーム" : undefined}
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
              ボランティ
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
          <HeaderAuth identity={identity} userState={userState} />
        )}
      </div>
    </header>
  );
}
