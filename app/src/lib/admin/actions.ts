"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/** 管理者かどうかを検証する */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  // m_user テーブルのロールで判定
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "admin") {
    throw new Error("管理者権限が必要です");
  }

  return user;
}

/** 審査対象の団体一覧を取得する */
export interface PendingOrganization {
  id: string;
  userId: string;
  organizationName: string;
  representativeName: string | null;
  contactEmail: string | null;
  activityAreas: string[];
  description: string | null;
  activityCategories: string[];
  websiteUrl: string | null;
  profileCompleteness: number;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewComment: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  verified: boolean;
  createdAt: string;
}

/** 審査履歴の 1 エントリ */
export interface ReviewHistoryEntry {
  id: string;
  organizationName: string;
  reviewStatus: "approved" | "rejected";
  reviewComment: string | null;
  reviewedAt: string;
  reviewedBy: string | null;
  reviewerName: string | null;
}

export async function fetchOrganizations(): Promise<PendingOrganization[]> {
  await requireAdmin();

  const orgs = await prisma.organizationProfile.findMany({
    orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
    select: {
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
    },
  });

  return orgs.map((org) => ({
    ...org,
    activityAreas: Array.isArray(org.activityAreas)
      ? (org.activityAreas as string[])
      : [],
    activityCategories: Array.isArray(org.activityCategories)
      ? (org.activityCategories as string[])
      : [],
    reviewedAt: org.reviewedAt?.toISOString() ?? null,
    createdAt: org.createdAt.toISOString(),
  }));
}

/** 承認・否認済みの審査履歴を取得する */
export async function fetchReviewHistory(): Promise<ReviewHistoryEntry[]> {
  await requireAdmin();

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
        .filter((reviewedBy): reviewedBy is string => reviewedBy !== null)
    )
  );

  const reviewers =
    reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true },
        })
      : [];
  const reviewerNameMap = new Map(
    reviewers.map((reviewer) => [reviewer.id, reviewer.name])
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

function revalidateAdminReviewViews() {
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/reviews/history");
  revalidatePath("/onboarding/pending");
  revalidatePath("/dashboard");
}

/** 団体を承認する */
export async function approveOrganization(
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    await prisma.organizationProfile.update({
      where: { id: orgId },
      data: {
        verified: true,
        reviewStatus: "approved",
        reviewComment: null,
        reviewedAt: new Date(),
        reviewedBy: adminUser.id,
      },
    });

    revalidateAdminReviewViews();

    return { success: true };
  } catch (err) {
    console.error("[approveOrganization]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "承認に失敗しました",
    };
  }
}

/** 団体を否認する */
export async function rejectOrganization(
  orgId: string,
  reviewComment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    const normalizedComment = reviewComment.trim();
    if (!normalizedComment) {
      return { success: false, error: "否認理由を入力してください" };
    }

    await prisma.organizationProfile.update({
      where: { id: orgId },
      data: {
        verified: false,
        reviewStatus: "rejected",
        reviewComment: normalizedComment,
        reviewedAt: new Date(),
        reviewedBy: adminUser.id,
      },
    });

    revalidateAdminReviewViews();

    return { success: true };
  } catch (err) {
    console.error("[rejectOrganization]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "否認に失敗しました",
    };
  }
}
