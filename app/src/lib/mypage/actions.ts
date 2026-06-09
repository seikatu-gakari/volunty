"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchParticipantProfileByUserIdWithDebug } from "@/lib/participant-profile/server";
import type {
  MyPageData,
  ApplicationWithDetails,
  ParticipantProfile,
  DataFetchAlert,
  DeleteAccountState,
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
  // accepted / completed は応募成立済みとして同じ UI（approved）で扱う
  accepted: "approved",
  completed: "approved",
  declined: "rejected",
};

function isMatchingCandidateStatus(value: string): value is MatchingCandidateStatus {
  return (MATCHING_CANDIDATE_STATUSES as readonly string[]).includes(value);
}

/**
 * 参加者マイページ用データ取得
 *
 * - participants テーブルからプロフィール情報を取得
 * - applications + opportunities + organizations を JOIN して応募一覧を取得
 * - status = 'approved' の場合のみ organizations.line_id を含める
 */
export async function fetchMyPageData(): Promise<MyPageData> {
  console.error("[fetchMyPageData2] ");
  const supabase = await createClient();
  console.error("[fetchMyPageData] ");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { profile: null, applications: [], alert: null };
  }

  // 参加者プロフィール取得
  let profile: ParticipantProfile | null = null;
  let alert: DataFetchAlert | null = null;
  try {
    const { profile: profileData, debug } =
      await fetchParticipantProfileByUserIdWithDebug(user.id);

    if (profileData) {
      profile = {
        id: profileData.id,
        name: profileData.name,
        region: profileData.region,
        diagnosis_type: profileData.diagnosisType,
        diagnosis_scores: profileData.diagnosisScores,
        diagnosis_updated_at: profileData.updatedAt?.toISOString() ?? null,
      };
    }

    if (debug.prismaErrorDetail) {
      const fallbackMessage = debug.supabaseErrorDetail
        ? "Prisma 接続に失敗し、Supabase フォールバックも失敗しました。"
        : "Prisma 接続に失敗したため、Supabase フォールバックで取得しました。";
      const supabaseDetail = debug.supabaseErrorDetail
        ? ` / Supabase: ${debug.supabaseErrorDetail}`
        : "";

      alert = {
        title: "プロフィール取得で接続フォールバックが発生しました",
        message: fallbackMessage,
        detail: `Prisma: ${debug.prismaErrorDetail}${supabaseDetail}`,
      };
    }

    console.error(profile);
  } catch (err) {
    console.error("[fetchMyPageData] 参加者プロフィール取得に失敗:", err);
  }

  // 応募一覧取得（opportunities + organizations JOIN）
  let applications: ApplicationWithDetails[] = [];
  try {
    const { data: candidateData, error: candidateError } = await supabase
      .from("t_matching_candidate")
      .select("id, status, message, created_at, applied_at, opportunity_id")
      .eq("participant_id", user.id)
      .in("status", [...MATCHING_CANDIDATE_STATUSES])
      .order("created_at", { ascending: false });

    if (candidateError || !candidateData) {
      return { profile, applications: [], alert };
    }

    const opportunityIds = Array.from(
      new Set(
        candidateData
          .map((candidate) => candidate.opportunity_id as string | null)
          .filter((id): id is string => typeof id === "string")
      )
    );

    const opportunitiesById = new Map<
      string,
      { title: string; organization_name: string; organization_line_id: string | null }
    >();

    if (opportunityIds.length > 0) {
      const { data: opportunityData } = await supabase
        .from("m_opportunity")
        .select(
          `
          id,
          title,
          m_organization_profile (
            organization_name,
            contact_line_id
          )
        `
        )
        .in("id", opportunityIds);

      for (const opportunity of opportunityData ?? []) {
        const organizationRaw = opportunity.m_organization_profile as
          | { organization_name: string; contact_line_id: string | null }
          | Array<{ organization_name: string; contact_line_id: string | null }>
          | null;
        const organization = Array.isArray(organizationRaw)
          ? (organizationRaw[0] ?? null)
          : organizationRaw;

        if (!organization) continue;

        opportunitiesById.set(opportunity.id as string, {
          title: (opportunity.title as string) ?? "",
          organization_name: organization.organization_name ?? "",
          organization_line_id: organization.contact_line_id ?? null,
        });
      }
    }

    applications = candidateData
      .flatMap((candidate) => {
        const rawStatus = candidate.status as string;
        if (!isMatchingCandidateStatus(rawStatus)) {
          console.error("[fetchMyPageData] 未対応ステータスを検出:", rawStatus);
          return [];
        }

        const opportunityId = candidate.opportunity_id as string;
        const opportunity = opportunitiesById.get(opportunityId);
        if (!opportunity) {
          console.error(
            "[fetchMyPageData] 応募データに案件または団体情報が不足:",
            candidate.id
          );
          return [];
        }

        const status = MATCHING_STATUS_TO_APPLICATION_STATUS[rawStatus];
        return [
          {
            id: candidate.id as string,
            status,
            message: (candidate.message as string) ?? null,
            created_at:
              (candidate.applied_at as string | null) ??
              (candidate.created_at as string),
            opportunity: {
              id: opportunityId,
              title: opportunity.title,
              organization_name: opportunity.organization_name,
              organization_line_id:
                status === "approved" ? opportunity.organization_line_id : null,
            },
          },
        ];
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (err) {
    console.error("[fetchMyPageData] 応募一覧取得に失敗:", err);
  }

  return { profile, applications, alert };
}

/** ログイン中ユーザーのアカウントを物理削除する。 */
export async function deleteMyAccount(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
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

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch (err) {
    console.error("[deleteMyAccount] Supabase管理クライアント作成に失敗:", err);
    return {
      error: "アカウント削除の準備に失敗しました。管理用環境変数を確認してください。",
    };
  }

  try {
    await prisma.user.deleteMany({
      where: { id: user.id },
    });
  } catch (err) {
    console.error("[deleteMyAccount] m_user の物理削除に失敗:", err);
    return {
      error: "アカウント削除に失敗しました。時間をおいて再度お試しください。",
    };
  }

  try {
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(
      user.id,
      false
    );

    if (deleteAuthError) {
      console.error(
        "[deleteMyAccount] Supabase Auth ユーザー削除に失敗:",
        deleteAuthError
      );
      return {
        error:
          "認証アカウントの削除に失敗しました。時間をおいて再度お試しください。",
      };
    }
  } catch (err) {
    console.error("[deleteMyAccount] Supabase Auth ユーザー削除で例外:", err);
    return {
      error: "認証アカウントの削除に失敗しました。時間をおいて再度お試しください。",
    };
  }

  redirect("/login?accountDeleted=1");
}
