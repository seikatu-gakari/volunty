import type { ViewerContext } from "@/lib/auth/viewer-context";

export type NotFoundNavigationHref =
  | "/"
  | "/admin"
  | "/onboarding/role"
  | "/mypage"
  | "/dashboard"
  | "/onboarding/pending";

export interface NotFoundNavigation {
  primary: {
    href: NotFoundNavigationHref;
    label: string;
  };
  showHomeLink: boolean;
  accountUnavailable: boolean;
}

function createNavigation(
  href: NotFoundNavigationHref,
  label: string,
  accountUnavailable = false,
): NotFoundNavigation {
  return {
    primary: { href, label },
    showHomeLink: href !== "/",
    accountUnavailable,
  };
}

export function getNotFoundNavigation(
  viewer: ViewerContext,
): NotFoundNavigation {
  if (viewer.status === "guest") {
    return createNavigation("/", "トップへ戻る");
  }

  if (viewer.status === "error") {
    return createNavigation("/", "トップへ戻る", true);
  }

  if (!viewer.isActive) {
    return createNavigation("/", "トップへ戻る");
  }

  if (viewer.role === "admin") {
    return createNavigation("/admin", "管理ダッシュボードへ戻る");
  }

  if (viewer.role === null) {
    return createNavigation("/onboarding/role", "アカウント種別を選択する");
  }

  if (viewer.role === "participant") {
    return viewer.hasParticipantProfile
      ? createNavigation("/mypage", "マイページへ戻る")
      : createNavigation("/onboarding/role", "プロフィール登録へ進む");
  }

  if (!viewer.hasOrganizationProfile) {
    return createNavigation("/onboarding/role", "プロフィール登録へ進む");
  }

  return viewer.organizationReviewStatus === "approved"
    ? createNavigation("/dashboard", "ダッシュボードへ戻る")
    : createNavigation("/onboarding/pending", "審査状況を確認する");
}
