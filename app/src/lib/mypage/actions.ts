"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchParticipantProfileByUserId } from "@/lib/participant-profile/server";
import type {
  MyPageData,
  ApplicationWithDetails,
  ParticipantProfile,
} from "./types";

const MATCHING_CANDIDATE_STATUSES = [
  "applied",
  "accepted",
  "completed",
  "declined",
] as const;

type MatchingCandidateStatus = (typeof MATCHING_CANDIDATE_STATUSES)[number];

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
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { profile: null, applications: [] };
  }

  // 参加者プロフィール取得
  let profile: ParticipantProfile | null = null;
  try {
    const profileData = await fetchParticipantProfileByUserId(user.id);

    if (profileData) {
      profile = {
        id: profileData.id,
        name: profileData.name,
        region: profileData.region,
        diagnosis_type: profileData.diagnosisType,
        diagnosis_scores: profileData.diagnosisScores,
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fetchMyPageData] 参加者プロフィール取得に失敗:", err);
    }
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
      return { profile, applications: [] };
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
    if (process.env.NODE_ENV === "development") {
      console.error("[fetchMyPageData] 応募一覧取得に失敗:", err);
    }
  }

  return { profile, applications };
}
