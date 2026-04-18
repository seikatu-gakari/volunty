"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchParticipantProfileByUserId } from "@/lib/participant-profile/server";
import { prisma } from "@/lib/prisma";
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
    const candidates = await prisma.matchingCandidate.findMany({
      where: {
        participantId: user.id,
        status: { in: MATCHING_CANDIDATE_STATUSES },
      },
      include: {
        opportunity: {
          include: {
            organization: {
              select: {
                organizationName: true,
                contactLineId: true,
              },
            },
          },
        },
      },
      orderBy: [{ appliedAt: "desc" }, { createdAt: "desc" }],
    });

    applications = candidates.flatMap((candidate) => {
      if (!isMatchingCandidateStatus(candidate.status)) {
        console.error("[fetchMyPageData] 未対応ステータスを検出:", candidate.status);
        return [];
      }

      if (!candidate.opportunity?.organization) {
        console.error(
          "[fetchMyPageData] 応募データに案件または団体情報が不足:",
          candidate.id
        );
        return [];
      }

      const status: ApplicationWithDetails["status"] =
        MATCHING_STATUS_TO_APPLICATION_STATUS[candidate.status];

      return [
        {
          id: candidate.id,
          status,
          message: candidate.message,
          created_at: (candidate.appliedAt ?? candidate.createdAt).toISOString(),
          opportunity: {
            id: candidate.opportunity.id,
            title: candidate.opportunity.title,
            organization_name: candidate.opportunity.organization.organizationName,
            organization_line_id:
              status === "approved"
                ? (candidate.opportunity.organization.contactLineId ?? null)
                : null,
          },
        },
      ];
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fetchMyPageData] 応募一覧取得に失敗:", err);
    }
  }

  return { profile, applications };
}
