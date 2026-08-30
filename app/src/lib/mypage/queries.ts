import "server-only";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { fetchParticipantProfileByUserIdWithDebug } from "@/lib/participant-profile/server";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import type {
  ApplicationWithDetails,
  ApplicationDetailResult,
  DataFetchAlert,
  MyPageData,
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
  accepted: "approved",
  completed: "completed",
  declined: "rejected",
};

function isMatchingCandidateStatus(value: string): value is MatchingCandidateStatus {
  return (MATCHING_CANDIDATE_STATUSES as readonly string[]).includes(value);
}

function normalizeEmbeddedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function fetchProfile(userId: string): Promise<{
  profile: ParticipantProfile | null;
  alert: DataFetchAlert | null;
}> {
  try {
    const { profile: profileData, debug } =
      await fetchParticipantProfileByUserIdWithDebug(userId);
    const latestDiagnosis = profileData?.latestDiagnosis ?? null;
    const profile = profileData
      ? {
          id: profileData.id,
          name: profileData.name,
          region: profileData.region,
          diagnosis_completed: latestDiagnosis !== null,
          diagnosis_style_type_label: latestDiagnosis?.styleTypeId
            ? (findStyleTypeById(latestDiagnosis.styleTypeId)?.name ?? null)
            : null,
          diagnosis_answered_at: latestDiagnosis?.answeredAt.toISOString() ?? null,
        }
      : null;

    if (!debug.prismaErrorDetail) return { profile, alert: null };

    const fallbackMessage = debug.supabaseErrorDetail
      ? "Prisma 接続に失敗し、Supabase フォールバックも失敗しました。"
      : "Prisma 接続に失敗したため、Supabase フォールバックで取得しました。";
    const supabaseDetail = debug.supabaseErrorDetail
      ? ` / Supabase: ${debug.supabaseErrorDetail}`
      : "";
    return {
      profile,
      alert: {
        title: "プロフィール取得で接続フォールバックが発生しました",
        message: fallbackMessage,
        detail: `Prisma: ${debug.prismaErrorDetail}${supabaseDetail}`,
      },
    };
  } catch (err) {
    console.error("[fetchMyPageData] 参加者プロフィール取得に失敗:", err);
    return { profile: null, alert: null };
  }
}

async function fetchApplications(userId: string): Promise<ApplicationWithDetails[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("t_matching_candidate")
      .select(
        "id, status, message, created_at, applied_at, status_changed_at, opportunity_id, m_opportunity(id, title, m_organization_profile(organization_name, contact_line_id))"
      )
      .eq("participant_id", userId)
      .in("status", [...MATCHING_CANDIDATE_STATUSES])
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data
      .flatMap((candidate) => {
        const rawStatus = candidate.status as string;
        if (!isMatchingCandidateStatus(rawStatus)) {
          console.error("[fetchMyPageData] 未対応ステータスを検出:", rawStatus);
          return [];
        }
        const opportunity = normalizeEmbeddedRecord(candidate.m_opportunity);
        const organization = normalizeEmbeddedRecord(
          opportunity?.m_organization_profile,
        );
        if (!opportunity || !organization) {
          console.error(
            "[fetchMyPageData] 応募データに案件または団体情報が不足:",
            candidate.id,
          );
          return [];
        }
        const status = MATCHING_STATUS_TO_APPLICATION_STATUS[rawStatus];
        return [{
          id: candidate.id as string,
          status,
          message: (candidate.message as string) ?? null,
          created_at:
            (candidate.applied_at as string | null) ?? (candidate.created_at as string),
          completed_at:
            rawStatus === "completed"
              ? (candidate.status_changed_at as string | null)
              : null,
          can_request_certificate: status === "completed",
          opportunity: {
            id: (candidate.opportunity_id as string) ?? (opportunity.id as string),
            title: (opportunity.title as string) ?? "",
            organization_name: (organization.organization_name as string) ?? "",
            organization_line_id:
              status === "approved" || status === "completed"
                ? ((organization.contact_line_id as string | null) ?? null)
                : null,
          },
        }];
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (err) {
    console.error("[fetchMyPageData] 応募一覧取得に失敗:", err);
    return [];
  }
}

/** 検証済み参加者のマイページ表示データを取得する。 */
export async function fetchMyPageData(userId: string): Promise<MyPageData> {
  const [profileResult, applications] = await Promise.all([
    fetchProfile(userId),
    fetchApplications(userId),
  ]);
  return { ...profileResult, applications };
}

/** 検証済み参加者の応募詳細を取得する。 */
export async function fetchMyApplicationDetailQuery(
  userId: string,
  applicationId: string
): Promise<ApplicationDetailResult> {
  try {
    const candidate = await prisma.matchingCandidate.findFirst({
      where: {
        id: applicationId,
        participantId: userId,
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

    if (!candidate) return { application: null, error: null };

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
  } catch (error) {
    console.error("[fetchMyApplicationDetailQuery] 予期しないエラー:", error);
    return { application: null, error: "予期しないエラーが発生しました" };
  }
}
