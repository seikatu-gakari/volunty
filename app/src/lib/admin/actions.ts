"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { processAccountDeletion } from "@/lib/account-deletion/orchestrator";
import {
  fetchDashboardStatsQuery,
  fetchOrganizationByIdQuery,
  fetchOrganizationsQuery,
  fetchPendingAccountDeletionQueries,
  fetchReviewHistoryQuery,
  fetchUsersQuery,
} from "./queries";

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

export interface AdminUserListItem {
  id: string;
  role: "participant" | "organization" | "admin";
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  region: string | null;
  organizationVerified: boolean | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PendingAccountDeletion {
  userId: string;
  displayName: string | null;
  createdAt: string;
  attemptCount: number;
  lastErrorCode: string | null;
}

/** 部分失敗して運用再処理を待つアカウント削除一覧を取得する。 */
export async function fetchPendingAccountDeletions(): Promise<
  PendingAccountDeletion[]
> {
  await requireAdmin();
  return fetchPendingAccountDeletionQueries();
}

/** 管理者として保留中の削除 saga を冪等に再処理する。 */
export async function retryPendingAccountDeletion(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("再処理対象が不正です");
  }
  const pendingRequest = await prisma.accountDeletionRequest.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!pendingRequest) {
    throw new Error("保留中の削除処理が見つかりません");
  }
  await processAccountDeletion(userId);
  revalidatePath("/admin/users");
}

/** 登録ユーザー一覧を取得する */
export async function fetchUsers(): Promise<AdminUserListItem[]> {
  await requireAdmin();
  return fetchUsersQuery();
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

export interface DashboardStats {
  userCount: number;
  matchingCount: number;
  pendingReviewCount: number;
}

/** 管理ダッシュボード用のサマリ件数を取得する */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  await requireAdmin();
  return fetchDashboardStatsQuery();
}

export async function fetchOrganizations(): Promise<PendingOrganization[]> {
  await requireAdmin();
  return fetchOrganizationsQuery();
}

/** 審査対象の団体を1件取得する */
export async function fetchOrganizationById(
  orgId: string
): Promise<PendingOrganization | null> {
  await requireAdmin();
  return fetchOrganizationByIdQuery(orgId);
}

/** 承認・否認済みの審査履歴を取得する */
export async function fetchReviewHistory(): Promise<ReviewHistoryEntry[]> {
  await requireAdmin();
  return fetchReviewHistoryQuery();
}

function revalidateAdminReviewViews() {
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/reviews/history");
  revalidatePath("/admin/reviews/[id]", "page");
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

/** ユーザーアカウントを凍結する（管理者のみ） */
export async function suspendUser(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminUser = await requireAdmin();

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      return { success: false, error: "凍結理由を入力してください" };
    }

    if (userId === adminUser.id) {
      return { success: false, error: "自分自身は凍結できません" };
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!target) {
      return { success: false, error: "対象ユーザーが見つかりません" };
    }

    if (target.role === "admin") {
      return { success: false, error: "管理者は凍結できません" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        suspendedAt: new Date(),
        suspendReason: normalizedReason,
        suspendedBy: adminUser.id,
      },
    });

    revalidatePath("/admin/users");

    return { success: true };
  } catch (err) {
    console.error("[suspendUser]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "凍結に失敗しました",
    };
  }
}

/** ユーザーアカウントの凍結を解除する（管理者のみ） */
export async function reactivateUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        suspendedBy: null,
      },
    });

    revalidatePath("/admin/users");

    return { success: true };
  } catch (err) {
    console.error("[reactivateUser]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "凍結解除に失敗しました",
    };
  }
}
