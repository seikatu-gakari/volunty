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

function revalidateAdminReviewViews() {
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/reviews");
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
