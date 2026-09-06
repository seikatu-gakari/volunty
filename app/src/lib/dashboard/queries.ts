import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import { toActivityStyleTagIds } from "@/lib/recommendations/activity-style-tags";
import { shouldFailDashboardAnalyticsForE2E } from "@/lib/e2e/dashboard-analytics-failure";
import {
  buildRecommendedParticipants,
  type RecommendedParticipantCandidate,
  type RecommendedParticipantOpportunity,
} from "./recommended-participants";
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
  MatchingHistoryResult,
  MatchingHistoryStatus,
  RecommendedParticipantDetailResult,
  RecommendedParticipantsResult,
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

type ApprovedOrganizationProfileResult =
  | { id: string }
  | { error: string; organizationProfileId?: string };

async function fetchApprovedOrganizationProfile(
  userId: string,
): Promise<ApprovedOrganizationProfileResult> {
  const organizationProfile = await prisma.organizationProfile.findUnique({
    where: { userId },
    select: { id: true, reviewStatus: true, user: { select: { role: true } } },
  });

  if (!organizationProfile) {
    return { error: "団体プロフィールが見つかりません" };
  }
  if (organizationProfile.user.role !== "organization") {
    return {
      error: "団体アカウントのみ利用できます",
      organizationProfileId: organizationProfile.id,
    };
  }
  if (organizationProfile.reviewStatus !== "approved") {
    return {
      error: "承認済み団体のみ利用できます",
      organizationProfileId: organizationProfile.id,
    };
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
type DashboardAnalyticsStage =
  | "organization_profile"
  | "opportunities"
  | "matching"
  | "views"
  | "approaches";

type DashboardAnalyticsStageResult<T> =
  | { success: true; data: T }
  | { success: false };

function getKnownErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === "string" ? code : undefined;
}

function logDashboardAnalyticsFailure(
  stage: DashboardAnalyticsStage,
  error: unknown,
  organizationProfileId?: string,
): void {
  const errorCode = getKnownErrorCode(error);
  console.error("dashboard_analytics_failed", {
    event: "dashboard_analytics_failed",
    stage,
    ...(errorCode ? { errorCode } : {}),
    ...(organizationProfileId ? { organizationProfileId } : {}),
  });
}

async function captureDashboardAnalyticsStage<T>(
  stage: Exclude<DashboardAnalyticsStage, "organization_profile" | "opportunities">,
  organizationProfileId: string,
  operation: () => Promise<T>,
): Promise<DashboardAnalyticsStageResult<T>> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    logDashboardAnalyticsFailure(stage, error, organizationProfileId);
    return { success: false };
  }
}

export async function fetchDashboardAnalyticsQuery(
  userId: string,
): Promise<DashboardAnalyticsResult> {
  let organizationProfile: ApprovedOrganizationProfileResult;
  try {
    organizationProfile = await fetchApprovedOrganizationProfile(userId);
  } catch (error) {
    logDashboardAnalyticsFailure("organization_profile", error);
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  if ("error" in organizationProfile) {
    logDashboardAnalyticsFailure(
      "organization_profile",
      undefined,
      organizationProfile.organizationProfileId,
    );
    return { success: false, error: organizationProfile.error };
  }

  try {
    if (shouldFailDashboardAnalyticsForE2E(await headers())) {
      const e2eFailure = new Error("E2E dashboard analytics failure");
      logDashboardAnalyticsFailure(
        "opportunities",
        e2eFailure,
        organizationProfile.id,
      );
      return { success: false, error: "予期しないエラーが発生しました" };
    }
  } catch (error) {
    logDashboardAnalyticsFailure(
      "organization_profile",
      error,
      organizationProfile.id,
    );
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  let opportunities: { id: string; title: string }[];
  try {
    opportunities = await prisma.opportunity.findMany({
      where: { organizationId: organizationProfile.id },
      select: { id: true, title: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  } catch (error) {
    logDashboardAnalyticsFailure("opportunities", error, organizationProfile.id);
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  const opportunityIds = opportunities.map((opportunity) => opportunity.id);
  const [matchingResult, viewsResult, approachesResult] = await Promise.all([
    captureDashboardAnalyticsStage(
      "matching",
      organizationProfile.id,
      () =>
        prisma.matchingCandidate.groupBy({
          by: ["opportunityId", "status"],
          where: { opportunityId: { in: opportunityIds } },
          _count: { _all: true },
        }),
    ),
    captureDashboardAnalyticsStage(
      "views",
      organizationProfile.id,
      () =>
        prisma.engagementEvent.groupBy({
          by: ["opportunityId"],
          where: { opportunityId: { in: opportunityIds }, event: "view" },
          _count: { _all: true },
        }),
    ),
    captureDashboardAnalyticsStage(
      "approaches",
      organizationProfile.id,
      () =>
        prisma.approach.groupBy({
          by: ["status"],
          where: { organizationId: organizationProfile.id },
          _count: { _all: true },
        }),
    ),
  ]);

  if (
    !matchingResult.success ||
    !viewsResult.success ||
    !approachesResult.success
  ) {
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  try {
    const matchingGroups = matchingResult.data;
    const viewGroups = viewsResult.data;
    const approachGroups = approachesResult.data;

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
      success: true,
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
    logDashboardAnalyticsFailure("matching", error, organizationProfile.id);
    return { success: false, error: "予期しないエラーが発生しました" };
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
                lineId: true,
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
    const participantLineId =
      application.status === "accepted"
        ? participantProfile?.lineId ?? null
        : undefined;
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
        ...(application.status === "accepted"
          ? { participant_line_id: participantLineId }
          : {}),
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

async function fetchPublishedOpportunityRequirements(
  organizationId: string
): Promise<RecommendedParticipantOpportunity[]> {
  return prisma.opportunity.findMany({
    where: { organizationId, status: "published" },
    select: { id: true, activityStyleTags: true, title: true },
  });
}

async function fetchPublicParticipantCandidates(): Promise<
  RecommendedParticipantCandidate[]
> {
  return prisma.participantProfile.findMany({
    where: { publicProfile: true },
    select: {
      id: true,
      userId: true,
      name: true,
      region: true,
      bio: true,
      interests: true,
      availability: true,
      preferredLocation: true,
      publicProfile: true,
      latestDiagnosisResult: { select: { styleTypeId: true, scaledScores: true } },
    },
  });
}

async function fetchRecommendedParticipantCandidate(
  participantProfileId: string
): Promise<RecommendedParticipantCandidate | null> {
  return prisma.participantProfile.findUnique({
    where: { id: participantProfileId },
    select: {
      id: true,
      userId: true,
      name: true,
      region: true,
      bio: true,
      interests: true,
      availability: true,
      preferredLocation: true,
      publicProfile: true,
      latestDiagnosisResult: { select: { styleTypeId: true, scaledScores: true } },
    },
  });
}

/** 検証済み承認団体のおすすめ参加者を取得する。 */
export async function fetchRecommendedParticipantsQuery(
  userId: string
): Promise<RecommendedParticipantsResult> {
  try {
    const organizationProfile = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organizationProfile) {
      return { participants: [], error: organizationProfile.error };
    }
    const opportunities = await fetchPublishedOpportunityRequirements(
      organizationProfile.id
    );
    if (opportunities.length === 0) {
      return { participants: [], emptyReason: "no_published_opportunities" };
    }
    const candidates = await fetchPublicParticipantCandidates();
    const participants = buildRecommendedParticipants(candidates, opportunities);
    return {
      participants,
      emptyReason:
        participants.length === 0 ? "no_recommended_participants" : undefined,
    };
  } catch (error) {
    console.error("[fetchRecommendedParticipantsQuery] 予期しないエラー:", error);
    return { participants: [], error: "予期しないエラーが発生しました" };
  }
}

/** 検証済み承認団体のおすすめ参加者詳細を取得する。 */
export async function fetchRecommendedParticipantDetailQuery(
  userId: string,
  participantProfileId: string
): Promise<RecommendedParticipantDetailResult> {
  try {
    const organizationProfile = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organizationProfile) {
      return { participant: null, error: organizationProfile.error };
    }
    const opportunities = await fetchPublishedOpportunityRequirements(
      organizationProfile.id
    );
    if (opportunities.length === 0) {
      return { participant: null, emptyReason: "no_published_opportunities" };
    }
    const candidate = await fetchRecommendedParticipantCandidate(participantProfileId);
    if (!candidate) return { participant: null, error: "参加者が見つかりません" };
    const [participant] = buildRecommendedParticipants([candidate], opportunities);
    if (!participant) return { participant: null, error: "参加者が見つかりません" };
    return { participant };
  } catch (error) {
    console.error(
      "[fetchRecommendedParticipantDetailQuery] 予期しないエラー:",
      error
    );
    return { participant: null, error: "予期しないエラーが発生しました" };
  }
}

function mapMatchingHistoryStatus(
  dbStatus: string
): MatchingHistoryStatus | null {
  if (dbStatus === "accepted") return "approved";
  if (dbStatus === "declined") return "rejected";
  if (dbStatus === "completed") return "completed";
  return null;
}

function toHistoryIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableHistoryIsoString(
  value: Date | string | null
): string | null {
  return value ? toHistoryIsoString(value) : null;
}

/** 検証済み承認団体のマッチング履歴を取得する。 */
export async function fetchMatchingHistoryQuery(
  userId: string
): Promise<MatchingHistoryResult> {
  try {
    const organizationProfile = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organizationProfile) {
      return { history: [], error: organizationProfile.error };
    }
    const records = await prisma.matchingCandidate.findMany({
      where: {
        status: { in: ["accepted", "declined", "completed"] },
        opportunity: { organizationId: organizationProfile.id },
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        statusChangedAt: true,
        participant: {
          select: { name: true, participantProfile: { select: { name: true } } },
        },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: [
        { statusChangedAt: "desc" },
        { appliedAt: "desc" },
        { id: "asc" },
      ],
    });
    const history = records.flatMap((record) => {
      const status = mapMatchingHistoryStatus(record.status);
      if (!status) return [];
      return [{
        id: record.id,
        status,
        participant_name:
          record.participant.participantProfile?.name ??
          record.participant.name ??
          "不明",
        opportunity_id: record.opportunity.id,
        opportunity_title: record.opportunity.title,
        applied_at: toNullableHistoryIsoString(record.appliedAt),
        status_changed_at: toHistoryIsoString(record.statusChangedAt),
      }];
    });
    return { history };
  } catch (error) {
    console.error("[fetchMatchingHistoryQuery] 予期しないエラー:", error);
    return { history: [], error: "予期しないエラーが発生しました" };
  }
}
