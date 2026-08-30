import "server-only";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import { toActivityStyleTagIds } from "@/lib/recommendations/activity-style-tags";
import type {
  Applicant,
  ApplicantDetailResult,
  ApplicantListOptions,
  ApplicantsResult,
  DashboardAnalyticsResult,
  DashboardData,
  DashboardOpportunity,
  OpportunityEditData,
  OpportunityEditResult,
  OpportunityStatus,
} from "./types";
import type { ParticipationMode } from "@/lib/opportunities/constants";

function normalizeDateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function mapApplicationStatus(dbStatus: string): Applicant["status"] {
  if (dbStatus === "applied" || dbStatus === "queued") return "pending";
  if (dbStatus === "accepted") return "approved";
  if (dbStatus === "completed") return "completed";
  if (dbStatus === "declined") return "rejected";
  return "pending";
}

function toApplicantDetailIsoString(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : value).replace(
    ".000Z",
    "Z",
  );
}

async function fetchApprovedOrganizationProfile(
  userId: string,
): Promise<{ id: string } | { error: string }> {
  const organizationProfile = await prisma.organizationProfile.findUnique({
    where: { userId },
    select: { id: true, reviewStatus: true },
  });

  if (!organizationProfile) {
    return { error: "団体プロフィールが見つかりません" };
  }
  if (organizationProfile.reviewStatus !== "approved") {
    return { error: "承認済み団体のみ利用できます" };
  }

  return { id: organizationProfile.id };
}

/** 検証済みの団体 userId で自団体の募集案件一覧を取得する。 */
export async function fetchMyOpportunitiesQuery(
  userId: string,
): Promise<DashboardData> {
  const supabase = await createClient();
  let opportunities: DashboardOpportunity[] = [];

  try {
    const { data: orgProfile } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!orgProfile) {
      return { opportunities: [] };
    }

    const { data: oppData } = await supabase
      .from("m_opportunity")
      .select(
        `
        id,
        title,
        status,
        created_at
      `,
      )
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .order("created_at", { ascending: false });

    if (oppData && oppData.length > 0) {
      const oppIds = oppData.map((opportunity) => opportunity.id as string);
      const { data: matchings } = await supabase
        .from("t_matching_candidate")
        .select("opportunity_id")
        .in("opportunity_id", oppIds);

      const countMap: Record<string, number> = {};
      for (const matching of matchings ?? []) {
        const opportunityId = matching.opportunity_id as string;
        countMap[opportunityId] = (countMap[opportunityId] ?? 0) + 1;
      }

      opportunities = oppData.map((opportunity) => ({
        id: opportunity.id as string,
        title: opportunity.title as string,
        status: opportunity.status as DashboardOpportunity["status"],
        created_at: opportunity.created_at as string,
        application_count: countMap[opportunity.id as string] ?? 0,
      }));
    }
  } catch {
    // テーブル未作成・接続エラー時は既存どおり空配列を返す。
  }

  return { opportunities };
}

/** 検証済みの団体 userId で自団体の案件編集データを取得する。 */
export async function fetchOpportunityForEditQuery(
  userId: string,
  id: string,
): Promise<OpportunityEditResult> {
  const supabase = await createClient();

  try {
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (profileError || !orgProfile) {
      return { opportunity: null, error: "団体プロフィールが見つかりません" };
    }

    const { data, error: fetchError } = await supabase
      .from("m_opportunity")
      .select(
        "id, title, description, activity_style_tags, required_qualifications, min_age, max_age, status, location, start_date, end_date, capacity, category, participation_mode",
      )
      .eq("id", id)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (fetchError || !data) {
      return { opportunity: null };
    }

    const row = data as unknown as {
      id: string;
      title: string;
      description: string | null;
      activity_style_tags: unknown;
      required_qualifications: unknown;
      min_age: number | null;
      max_age: number | null;
      status: OpportunityStatus;
      location: string | null;
      start_date: string | null;
      end_date: string | null;
      capacity: number | null;
      category: string | null;
      participation_mode: ParticipationMode | null;
    };
    const opportunity: OpportunityEditData = {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      activity_style_tags: toActivityStyleTagIds(row.activity_style_tags),
      required_qualifications: Array.isArray(row.required_qualifications)
        ? row.required_qualifications.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      min_age: row.min_age ?? null,
      max_age: row.max_age ?? null,
      status: row.status,
      location: row.location ?? null,
      start_date: normalizeDateOnly(row.start_date),
      end_date: normalizeDateOnly(row.end_date),
      capacity: row.capacity ?? null,
      category: row.category ?? null,
      participation_mode: row.participation_mode ?? null,
    };

    return { opportunity };
  } catch {
    return { opportunity: null, error: "データの取得に失敗しました" };
  }
}

/** 検証済みの団体 userId で自団体案件の応募者一覧を取得する。 */
export async function fetchApplicantsForOpportunityQuery(
  userId: string,
  opportunityId: string,
  options: ApplicantListOptions = {},
): Promise<ApplicantsResult> {
  try {
    const supabase = await createClient();
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (profileError || !orgProfile) {
      return { data: null, error: "団体プロフィールが見つかりません" };
    }

    const { data: oppData, error: oppError } = await supabase
      .from("m_opportunity")
      .select("id, title, description, status, created_at")
      .eq("id", opportunityId)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (oppError || !oppData) {
      return { data: null, error: "案件が見つかりません" };
    }

    const { data: matchingData } = await supabase
      .from("t_matching_candidate")
      .select(
        "id, status, message, applied_at, status_changed_at, participant_id",
      )
      .eq("opportunity_id", opportunityId)
      .order("applied_at", { ascending: false });

    const participantIds = (matchingData ?? []).map(
      (matching) => matching.participant_id as string,
    );
    const profileMap: Record<
      string,
      { name: string; styleTypeLabel: string | null }
    > = {};

    if (participantIds.length > 0) {
      const participants = await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: {
          id: true,
          name: true,
          participantProfile: {
            select: {
              name: true,
              latestDiagnosisResult: { select: { styleTypeId: true } },
            },
          },
        },
      });

      for (const participant of participants) {
        const profile = participant.participantProfile;
        const styleTypeId = profile?.latestDiagnosisResult?.styleTypeId ?? null;
        profileMap[participant.id] = {
          name: profile?.name ?? participant.name ?? "不明",
          styleTypeLabel: styleTypeId
            ? (findStyleTypeById(styleTypeId)?.name ?? null)
            : null,
        };
      }
    }

    const applicants: Applicant[] = (matchingData ?? [])
      .map((matching) => {
        const profile = profileMap[matching.participant_id as string];
        return {
          id: matching.id as string,
          status: mapApplicationStatus(matching.status as string),
          message: (matching.message as string) ?? null,
          created_at: (matching.applied_at as string) ?? "",
          completed_at:
            matching.status === "completed"
              ? (matching.status_changed_at as string)
              : null,
          participant_name: profile?.name ?? "不明",
          style_type_label: profile?.styleTypeLabel ?? null,
        };
      })
      .filter((applicant) => {
        const status = options.status ?? "all";
        return status === "all" || applicant.status === status;
      });

    const compareAppliedDesc = (first: Applicant, second: Applicant) => {
      const firstTime = Date.parse(first.created_at);
      const secondTime = Date.parse(second.created_at);
      const normalizedFirst = Number.isNaN(firstTime) ? 0 : firstTime;
      const normalizedSecond = Number.isNaN(secondTime) ? 0 : secondTime;

      if (normalizedFirst !== normalizedSecond) {
        return normalizedSecond - normalizedFirst;
      }
      return first.id.localeCompare(second.id);
    };

    applicants.sort((first, second) => {
      switch (options.sort ?? "applied_desc") {
        case "applied_asc":
          return -compareAppliedDesc(first, second);
        case "compatibility": {
          const firstStyle = first.style_type_label ? 0 : 1;
          const secondStyle = second.style_type_label ? 0 : 1;
          if (firstStyle !== secondStyle) return firstStyle - secondStyle;
          return compareAppliedDesc(first, second);
        }
        case "applied_desc":
        default:
          return compareAppliedDesc(first, second);
      }
    });

    return {
      data: {
        id: oppData.id as string,
        title: oppData.title as string,
        description: (oppData.description as string) ?? null,
        status: oppData.status as "draft" | "published" | "closed",
        created_at: oppData.created_at as string,
        applicants,
      },
    };
  } catch (error) {
    console.error("[fetchApplicantsForOpportunity] 予期しないエラー:", error);
    return { data: null, error: "予期しないエラーが発生しました" };
  }
}

/** 検証済みの団体 userId でダッシュボード分析を取得する。 */
export async function fetchDashboardAnalyticsQuery(
  userId: string,
): Promise<DashboardAnalyticsResult> {
  const emptyApproaches = {
    sentTotal: 0,
    acceptedCount: 0,
    acceptanceRate: 0,
    declinedCount: 0,
    pendingCount: 0,
  };

  try {
    const organizationProfile = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organizationProfile) {
      return {
        opportunities: [],
        approaches: emptyApproaches,
        error: organizationProfile.error,
      };
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { organizationId: organizationProfile.id },
      select: { id: true, title: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    const opportunityIds = opportunities.map((opportunity) => opportunity.id);

    const [matchingGroups, viewGroups, approachGroups] = await Promise.all([
      prisma.matchingCandidate.groupBy({
        by: ["opportunityId", "status"],
        where: { opportunityId: { in: opportunityIds } },
        _count: { _all: true },
      }),
      prisma.engagementEvent.groupBy({
        by: ["opportunityId"],
        where: { opportunityId: { in: opportunityIds }, event: "view" },
        _count: { _all: true },
      }),
      prisma.approach.groupBy({
        by: ["status"],
        where: { organizationId: organizationProfile.id },
        _count: { _all: true },
      }),
    ]);

    const matchingByOpportunity = new Map<string, Record<string, number>>();
    for (const group of matchingGroups) {
      const current = matchingByOpportunity.get(group.opportunityId) ?? {};
      current[group.status] = group._count._all;
      matchingByOpportunity.set(group.opportunityId, current);
    }
    const viewsByOpportunity = new Map(
      viewGroups.map((group) => [group.opportunityId, group._count._all]),
    );
    const analytics = opportunities.map((opportunity) => {
      const counts = matchingByOpportunity.get(opportunity.id) ?? {};
      const applicationCount = Object.values(counts).reduce(
        (total, count) => total + count,
        0,
      );
      const completedCount = counts.completed ?? 0;
      const approvedCount = (counts.accepted ?? 0) + completedCount;
      return {
        opportunityId: opportunity.id,
        title: opportunity.title,
        viewCount: viewsByOpportunity.get(opportunity.id) ?? 0,
        applicationCount,
        approvedCount,
        approvalRate:
          applicationCount > 0
            ? Math.round((approvedCount / applicationCount) * 100)
            : 0,
        declinedCount: counts.declined ?? 0,
        completedCount,
      };
    });

    const approachCounts = Object.fromEntries(
      approachGroups.map((group) => [group.status, group._count._all]),
    ) as Record<string, number>;
    const sentTotal = Object.values(approachCounts).reduce(
      (total, count) => total + count,
      0,
    );
    const acceptedCount = approachCounts.accepted ?? 0;

    return {
      opportunities: analytics,
      approaches: {
        sentTotal,
        acceptedCount,
        acceptanceRate:
          sentTotal > 0 ? Math.round((acceptedCount / sentTotal) * 100) : 0,
        declinedCount: approachCounts.declined ?? 0,
        pendingCount: approachCounts.sent ?? 0,
      },
    };
  } catch (error) {
    console.error("[fetchDashboardAnalytics] 予期しないエラー:", error);
    return {
      opportunities: [],
      approaches: emptyApproaches,
      error: "予期しないエラーが発生しました",
    };
  }
}

/** 検証済みの団体 userId で応募者詳細を取得する。 */
export async function fetchApplicantDetailQuery(
  userId: string,
  applicationId: string,
): Promise<ApplicantDetailResult> {
  try {
    const organizationProfile = await prisma.organizationProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        reviewStatus: true,
        user: { select: { role: true } },
      },
    });

    if (!organizationProfile) {
      return { data: null, error: "団体プロフィールが見つかりません" };
    }
    if (organizationProfile.user.role !== "organization") {
      return { data: null, error: "団体アカウントのみ利用できます" };
    }
    if (organizationProfile.reviewStatus !== "approved") {
      return { data: null, error: "承認済み団体のみ利用できます" };
    }

    const application = await prisma.matchingCandidate.findFirst({
      where: {
        id: applicationId,
        opportunity: { organizationId: organizationProfile.id },
      },
      select: {
        id: true,
        status: true,
        message: true,
        appliedAt: true,
        statusChangedAt: true,
        participant: {
          select: {
            name: true,
            participantProfile: {
              select: {
                name: true,
                latestDiagnosisResult: { select: { styleTypeId: true } },
              },
            },
          },
        },
        opportunity: { select: { id: true, title: true } },
      },
    });

    if (!application) {
      return { data: null, error: "この操作を行う権限がありません" };
    }

    const participantProfile = application.participant.participantProfile;
    const styleTypeId = participantProfile?.latestDiagnosisResult?.styleTypeId ?? null;
    const styleType = styleTypeId
      ? (findStyleTypeById(styleTypeId) ?? null)
      : null;

    return {
      data: {
        id: application.id,
        status: mapApplicationStatus(application.status),
        message: application.message,
        created_at: application.appliedAt
          ? toApplicantDetailIsoString(application.appliedAt)
          : "",
        completed_at:
          application.status === "completed"
            ? toApplicantDetailIsoString(application.statusChangedAt)
            : null,
        participant_name:
          participantProfile?.name ?? application.participant.name ?? "不明",
        style_type_label: styleType?.name ?? null,
        opportunity_id: application.opportunity.id,
        opportunity_title: application.opportunity.title,
        style_type_detail: styleType
          ? {
              name: styleType.name,
              nameEn: styleType.nameEn,
              description: styleType.description,
              tendencies: styleType.tendencies,
              activityExamples: styleType.activityExamples,
            }
          : null,
      },
    };
  } catch (error) {
    console.error("[fetchApplicantDetail] 予期しないエラー:", error);
    return { data: null, error: "予期しないエラーが発生しました" };
  }
}
