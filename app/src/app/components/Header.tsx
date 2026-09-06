import Link from "next/link";
import {
  getViewerContext,
  type ViewerContext,
} from "@/lib/auth/viewer-context";
import { HeaderAuth } from "@/app/components/HeaderAuth";
import { PublicHeaderNavigation } from "@/app/components/PublicHeaderNavigation";
import { BrandLogo } from "@/app/components/BrandLogo";

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
  const showPublicNavigation = variant === "landing" && !identity;

  return (
    <header className="sticky top-0 z-20 border-b border-header-border bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex h-[77px] max-w-7xl items-center justify-between px-8 pt-4 pb-px">
        <Link
          href="/"
          className="shrink-0"
          aria-label="ボランティ ホーム"
        >
          <span className="flex flex-col">
            <BrandLogo />
            <span className="ml-10 hidden text-xs leading-4 text-text-body sm:block">
              あなたにぴったりの活動を見つけよう
            </span>
          </span>
        </Link>
        {showPublicNavigation && (
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
        {showPublicNavigation ? (
          <PublicHeaderNavigation />
        ) : (
          <HeaderAuth identity={identity} userState={userState} />
        )}
      </div>
    </header>
  );
}
