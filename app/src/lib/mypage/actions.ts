"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isAccountDeletionEnabled } from "@/lib/account-deletion/config";
import { processAccountDeletion } from "@/lib/account-deletion/orchestrator";
import type {
  ApplicationWithDetails,
  DeleteAccountState,
  ApplicationDetailResult,
} from "./types";

const MATCHING_CANDIDATE_STATUSES = [
  "applied",
  "accepted",
  "completed",
  "declined",
] as const;

type MatchingCandidateStatus = (typeof MATCHING_CANDIDATE_STATUSES)[number];

const DELETE_ACCOUNT_CONFIRMATION = "削除する";

const MATCHING_STATUS_TO_APPLICATION_STATUS: Record<
  MatchingCandidateStatus,
  ApplicationWithDetails["status"]
> = {
  applied: "pending",
  accepted: "approved",
  completed: "completed",
  declined: "rejected",
};

function isMatchingCandidateStatus(value: string): value is MatchingCandidateStatus {
  return (MATCHING_CANDIDATE_STATUSES as readonly string[]).includes(value);
}

/** ログイン中ユーザーのアカウントを物理削除する。 */
export async function deleteMyAccount(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  if (!isAccountDeletionEnabled()) {
    return { error: "現在、アカウント削除を一時停止しています。" };
  }

  if (formData.get("confirmation") !== DELETE_ACCOUNT_CONFIRMATION) {
    return { error: "確認欄に「削除する」と入力してください。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "ログイン状態を確認できませんでした。再ログインしてからお試しください。",
    };
  }

  let deletionStatus: "completed" | "auth_failed" | "cleanup_pending";
  try {
    const result = await processAccountDeletion(user.id);
    deletionStatus = result.status;
    if (result.status === "auth_failed") {
      return {
        error:
          "認証アカウントの削除に失敗しました。時間をおいて再度お試しください。",
      };
    }
  } catch (err) {
    console.error("[deleteMyAccount] アカウント削除処理の開始に失敗:", err);
    return {
      error: "アカウント削除に失敗しました。時間をおいて再度お試しください。",
    };
  }

  if (deletionStatus === "cleanup_pending") {
    redirect("/login?accountDeletionPending=1");
  }

  redirect("/login?accountDeleted=1");
}

/**
 * 参加者の応募詳細取得
 *
 * - ログイン中ユーザーの応募のみ返す（participantId チェックで認可）
 * - status = approved / completed の場合のみ LINE 連絡先を公開
 */
export async function fetchMyApplicationDetail(
  applicationId: string
): Promise<ApplicationDetailResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { application: null, error: "ログインが必要です" };
  }

  try {
    const candidate = await prisma.matchingCandidate.findFirst({
      where: {
        id: applicationId,
        participantId: user.id,
        status: { in: [...MATCHING_CANDIDATE_STATUSES] },
      },
      select: {
        id: true,
        status: true,
        message: true,
        appliedAt: true,
        createdAt: true,
        statusChangedAt: true,
        opportunity: {
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            startDate: true,
            endDate: true,
            category: true,
            participationMode: true,
            organization: {
              select: {
                organizationName: true,
                contactLineId: true,
                contactLineUrl: true,
              },
            },
          },
        },
      },
    });

    if (!candidate) {
      return { application: null, error: null };
    }

    const rawStatus = candidate.status as string;
    if (!isMatchingCandidateStatus(rawStatus)) {
      return { application: null, error: null };
    }

    const status = MATCHING_STATUS_TO_APPLICATION_STATUS[rawStatus];
    const showContact = status === "approved" || status === "completed";
    const completedAt =
      rawStatus === "completed"
        ? candidate.statusChangedAt instanceof Date
          ? candidate.statusChangedAt.toISOString()
          : String(candidate.statusChangedAt)
        : null;
    const appliedAt =
      candidate.appliedAt instanceof Date
        ? candidate.appliedAt.toISOString()
        : candidate.createdAt instanceof Date
          ? candidate.createdAt.toISOString()
          : String(candidate.createdAt);

    return {
      application: {
        id: candidate.id,
        status,
        message: candidate.message ?? null,
        applied_at: appliedAt,
        completed_at: completedAt,
        can_request_certificate: status === "completed",
        opportunity: {
          id: candidate.opportunity.id,
          title: candidate.opportunity.title,
          description: candidate.opportunity.description ?? null,
          location: candidate.opportunity.location ?? null,
          start_date:
            candidate.opportunity.startDate instanceof Date
              ? candidate.opportunity.startDate.toISOString()
              : candidate.opportunity.startDate ?? null,
          end_date:
            candidate.opportunity.endDate instanceof Date
              ? candidate.opportunity.endDate.toISOString()
              : candidate.opportunity.endDate ?? null,
          category: candidate.opportunity.category ?? null,
          participation_mode: candidate.opportunity.participationMode ?? null,
          organization_name: candidate.opportunity.organization.organizationName,
          organization_line_id: showContact
            ? (candidate.opportunity.organization.contactLineId ?? null)
            : null,
          organization_line_url: showContact
            ? (candidate.opportunity.organization.contactLineUrl ?? null)
            : null,
        },
      },
      error: null,
    };
  } catch (err) {
    console.error("[fetchMyApplicationDetail] 予期しないエラー:", err);
    return { application: null, error: "予期しないエラーが発生しました" };
  }
}
