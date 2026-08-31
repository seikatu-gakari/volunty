import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AdminUserListItem,
  DashboardStats,
  PendingAccountDeletion,
  PendingOrganization,
  ReviewHistoryEntry,
} from "./actions";

function resolveDisplayName(
  userName: string | null,
  participantName: string | null | undefined,
  organizationName: string | null | undefined,
) {
  return (
    userName?.trim() ||
    participantName?.trim() ||
    organizationName?.trim() ||
    "(名前未設定)"
  );
}

/** 管理者認可済みのリクエストで、保留中の削除 saga を取得する。 */
export async function fetchPendingAccountDeletionQueries(): Promise<
  PendingAccountDeletion[]
> {
  const requests = await prisma.accountDeletionRequest.findMany({
    orderBy: { createdAt: "asc" },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: requests.map((request) => request.userId) } },
    select: {
      id: true,
      name: true,
      participantProfile: { select: { name: true } },
      organizationProfile: { select: { organizationName: true } },
    },
  });
  const names = new Map(
    users.map((user) => [
      user.id,
      resolveDisplayName(
        user.name,
        user.participantProfile?.name,
        user.organizationProfile?.organizationName,
      ),
    ]),
  );

  return requests.map((request) => ({
    userId: request.userId,
    displayName: names.get(request.userId) ?? null,
    createdAt: request.createdAt.toISOString(),
    attemptCount: request.attemptCount,
    lastErrorCode: request.lastErrorCode,
  }));
}

/** 管理者認可済みのリクエストで登録ユーザー一覧を取得する。 */
export async function fetchUsersQuery(): Promise<AdminUserListItem[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
      suspendedAt: true,
      suspendReason: true,
      lastLoginAt: true,
      createdAt: true,
      participantProfile: {
        select: { name: true, region: true },
      },
      organizationProfile: {
        select: { organizationName: true, verified: true },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    role: user.role,
    displayName: resolveDisplayName(
      user.name,
      user.participantProfile?.name,
      user.organizationProfile?.organizationName,
    ),
    email: user.email,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    suspendReason: user.suspendReason,
    region:
      user.role === "participant"
        ? user.participantProfile?.region ?? null
        : null,
    organizationVerified:
      user.role === "organization"
        ? user.organizationProfile?.verified ?? null
        : null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
}

/** 管理者認可済みのリクエストでダッシュボードのサマリを取得する。 */
export async function fetchDashboardStatsQuery(): Promise<DashboardStats> {
  const [userCount, matchingCount, pendingReviewCount] = await Promise.all([
    prisma.user.count({
      where: { role: { not: "admin" } },
    }),
    prisma.matchingCandidate.count({
      where: { status: { in: ["applied", "accepted", "completed"] } },
    }),
    prisma.organizationProfile.count({
      where: { reviewStatus: "pending" },
    }),
  ]);

  return { userCount, matchingCount, pendingReviewCount };
}

const organizationReviewSelect = {
  id: true,
  userId: true,
  organizationName: true,
  representativeName: true,
  contactEmail: true,
  activityAreas: true,
  description: true,
  activityCategories: true,
  websiteUrl: true,
  profileCompleteness: true,
  reviewStatus: true,
  reviewComment: true,
  reviewedAt: true,
  reviewedBy: true,
  verified: true,
  createdAt: true,
} satisfies Prisma.OrganizationProfileSelect;

type OrganizationReviewRecord = Prisma.OrganizationProfileGetPayload<{
  select: typeof organizationReviewSelect;
}>;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapPendingOrganization(
  org: OrganizationReviewRecord,
): PendingOrganization {
  return {
    ...org,
    activityAreas: toStringArray(org.activityAreas),
    activityCategories: toStringArray(org.activityCategories),
    reviewedAt: org.reviewedAt?.toISOString() ?? null,
    createdAt: org.createdAt.toISOString(),
  };
}

/** 管理者認可済みのリクエストで団体一覧を取得する。 */
export async function fetchOrganizationsQuery(): Promise<PendingOrganization[]> {
  const orgs = await prisma.organizationProfile.findMany({
    orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
    select: organizationReviewSelect,
  });

  return orgs.map(mapPendingOrganization);
}

/** 管理者認可済みのリクエストで団体審査対象を1件取得する。 */
export async function fetchOrganizationByIdQuery(
  orgId: string,
): Promise<PendingOrganization | null> {
  const org = await prisma.organizationProfile.findUnique({
    where: { id: orgId },
    select: organizationReviewSelect,
  });

  return org ? mapPendingOrganization(org) : null;
}

/** 管理者認可済みのリクエストで承認・否認済みの審査履歴を取得する。 */
export async function fetchReviewHistoryQuery(): Promise<ReviewHistoryEntry[]> {
  const histories = await prisma.organizationProfile.findMany({
    where: {
      reviewStatus: { in: ["approved", "rejected"] },
      reviewedAt: { not: null },
    },
    orderBy: { reviewedAt: "desc" },
    select: {
      id: true,
      organizationName: true,
      reviewStatus: true,
      reviewComment: true,
      reviewedAt: true,
      reviewedBy: true,
    },
  });

  const reviewerIds = Array.from(
    new Set(
      histories
        .map((history) => history.reviewedBy)
        .filter((reviewedBy): reviewedBy is string => reviewedBy !== null),
    ),
  );

  const reviewers =
    reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true },
        })
      : [];
  const reviewerNameMap = new Map(
    reviewers.map((reviewer) => [reviewer.id, reviewer.name]),
  );

  return histories.map((history) => {
    if (!history.reviewedAt) {
      throw new Error("審査日時がない履歴は表示できません");
    }

    return {
      id: history.id,
      organizationName: history.organizationName,
      reviewStatus: history.reviewStatus as ReviewHistoryEntry["reviewStatus"],
      reviewComment: history.reviewComment,
      reviewedAt: history.reviewedAt.toISOString(),
      reviewedBy: history.reviewedBy,
      reviewerName: history.reviewedBy
        ? (reviewerNameMap.get(history.reviewedBy) ?? null)
        : null,
    };
  });
}
