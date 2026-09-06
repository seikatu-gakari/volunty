import type { ViewerContext } from "@/lib/auth/viewer-context";
import { describe, expect, it } from "vitest";
import { getNotFoundNavigation } from "./not-found-navigation";

type AuthenticatedViewer = Extract<
  ViewerContext,
  { status: "authenticated" }
>;

const baseViewer: AuthenticatedViewer = {
  status: "authenticated",
  identity: {
    id: "user-1",
    email: "user@example.com",
    displayName: "利用者",
  },
  role: "participant",
  isActive: true,
  hasParticipantProfile: true,
  hasOrganizationProfile: false,
  organizationVerified: false,
  organizationReviewStatus: null,
};

function authenticatedViewer(
  overrides: Partial<AuthenticatedViewer> = {},
): AuthenticatedViewer {
  return { ...baseViewer, ...overrides };
}

describe("getNotFoundNavigation", () => {
  it.each([
    [
      "guest",
      { status: "guest" } satisfies ViewerContext,
      {
        primary: { href: "/", label: "トップへ戻る" },
        showHomeLink: false,
        accountUnavailable: false,
      },
    ],
    [
      "取得エラー",
      {
        status: "error",
        errorCode: "account_lookup_failed",
      } satisfies ViewerContext,
      {
        primary: { href: "/", label: "トップへ戻る" },
        showHomeLink: false,
        accountUnavailable: true,
      },
    ],
    [
      "非アクティブな認証済みユーザー",
      authenticatedViewer({ isActive: false }),
      {
        primary: { href: "/", label: "トップへ戻る" },
        showHomeLink: false,
        accountUnavailable: false,
      },
    ],
    [
      "admin",
      authenticatedViewer({ role: "admin" }),
      {
        primary: { href: "/admin", label: "管理ダッシュボードへ戻る" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "role未選択",
      authenticatedViewer({ role: null }),
      {
        primary: {
          href: "/onboarding/role",
          label: "アカウント種別を選択する",
        },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "プロフィール未登録のparticipant",
      authenticatedViewer({ role: "participant", hasParticipantProfile: false }),
      {
        primary: { href: "/onboarding/role", label: "プロフィール登録へ進む" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "プロフィール登録済みparticipant",
      authenticatedViewer({ role: "participant", hasParticipantProfile: true }),
      {
        primary: { href: "/mypage", label: "マイページへ戻る" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "プロフィール未登録のorganization",
      authenticatedViewer({
        role: "organization",
        hasOrganizationProfile: false,
        organizationVerified: true,
        organizationReviewStatus: "approved",
      }),
      {
        primary: { href: "/onboarding/role", label: "プロフィール登録へ進む" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "reviewStatusがapprovedのorganization",
      authenticatedViewer({
        role: "organization",
        hasOrganizationProfile: true,
        organizationVerified: false,
        organizationReviewStatus: "approved",
      }),
      {
        primary: { href: "/dashboard", label: "ダッシュボードへ戻る" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "verifiedでもpendingのorganization",
      authenticatedViewer({
        role: "organization",
        hasOrganizationProfile: true,
        organizationVerified: true,
        organizationReviewStatus: "pending",
      }),
      {
        primary: { href: "/onboarding/pending", label: "審査状況を確認する" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "rejectedのorganization",
      authenticatedViewer({
        role: "organization",
        hasOrganizationProfile: true,
        organizationVerified: false,
        organizationReviewStatus: "rejected",
      }),
      {
        primary: { href: "/onboarding/pending", label: "審査状況を確認する" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
    [
      "reviewStatus不明のorganization",
      authenticatedViewer({
        role: "organization",
        hasOrganizationProfile: true,
        organizationVerified: false,
        organizationReviewStatus: null,
      }),
      {
        primary: { href: "/onboarding/pending", label: "審査状況を確認する" },
        showHomeLink: true,
        accountUnavailable: false,
      },
    ],
  ] as const)("%sの復帰先を決定する", (_name, viewer, expected) => {
    expect(getNotFoundNavigation(viewer)).toEqual(expected);
  });
});
