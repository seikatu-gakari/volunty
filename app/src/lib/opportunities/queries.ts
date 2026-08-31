import "server-only";

import { after } from "next/server";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { findActivityStyleTag, toActivityStyleTagIds } from "@/lib/recommendations/activity-style-tags";
import type { ExistingApplication, OpportunityDetail, OpportunityDetailResult } from "./types";

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeEmbeddedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function mapMatchingStatus(dbStatus: string): ExistingApplication["status"] {
  if (dbStatus === "applied" || dbStatus === "queued") return "pending";
  if (dbStatus === "accepted") return "approved";
  if (dbStatus === "completed") return "completed";
  if (dbStatus === "declined" || dbStatus === "cancelled") return "rejected";
  return "pending";
}

function isActiveParticipant(viewer: ViewerContext): viewer is Extract<ViewerContext, { status: "authenticated" }> {
  return (
    viewer.status === "authenticated" &&
    viewer.isActive &&
    viewer.role === "participant" &&
    viewer.hasParticipantProfile
  );
}

/** 閲覧イベントの流入元 */
export type OpportunityViewSource = "recommendation" | "search" | "direct";

/** 検証済み ViewerContext を用いて公開案件詳細を取得する。 */
export async function fetchOpportunityDetail(
  opportunityId: string,
  viewer: ViewerContext,
  viewSource: OpportunityViewSource = "direct",
): Promise<OpportunityDetailResult> {
  try {
    const supabase = await createClient();
    const { data: oppData, error: oppError } = await supabase
      .from("m_opportunity")
      .select(
        "id, title, description, activity_style_tags, required_qualifications, min_age, max_age, status, published_at, created_at, location, start_date, end_date, capacity, current_applicants, category, participation_mode, m_organization_profile(id, organization_name, description)",
      )
      .eq("id", opportunityId)
      .single();
    if (oppError || !oppData) return emptyDetail();
    const publishedAt = oppData.published_at as string | null;
    if (
      oppData.status !== "published" ||
      (publishedAt && new Date(publishedAt).getTime() > Date.now())
    ) return emptyDetail();

    const org = normalizeEmbeddedRecord(oppData.m_organization_profile);
    const opportunity: OpportunityDetail = {
      id: oppData.id as string,
      title: oppData.title as string,
      description: (oppData.description as string) ?? null,
      activity_style_labels: toActivityStyleTagIds(oppData.activity_style_tags)
        .map((tagId) => findActivityStyleTag(tagId)?.label)
        .filter((label): label is string => Boolean(label)),
      required_qualifications: toStringArray(oppData.required_qualifications),
      min_age: (oppData.min_age as number | null) ?? null,
      max_age: (oppData.max_age as number | null) ?? null,
      status: oppData.status as OpportunityDetail["status"],
      organization: {
        id: (org?.id as string) ?? "",
        name: (org?.organization_name as string) ?? "",
        description: (org?.description as string | null) ?? null,
      },
      created_at: oppData.created_at as string,
      location: (oppData.location as string | null) ?? null,
      start_date: ((oppData.start_date as string | null) ?? null)?.slice(0, 10) ?? null,
      end_date: ((oppData.end_date as string | null) ?? null)?.slice(0, 10) ?? null,
      capacity: (oppData.capacity as number | null) ?? null,
      current_applicants: (oppData.current_applicants as number | null) ?? 0,
      category: (oppData.category as string | null) ?? null,
      participation_mode: (oppData.participation_mode as OpportunityDetail["participation_mode"]) ?? null,
    };
    const participant = isActiveParticipant(viewer);
    const userId = participant ? viewer.identity.id : null;
    const countPromise = prisma.matchingCandidate
      .count({
        where: { opportunityId, status: { in: ["applied", "accepted", "completed"] } },
      })
      .catch((err) => {
        console.error("[fetchOpportunityDetail] 応募者数の集計に失敗:", err);
        return null;
      });
    const applicationPromise: Promise<ExistingApplication | null> = userId
      ? (async () => {
          try {
            const { data } = await supabase
              .from("t_matching_candidate")
              .select("id, status, message, applied_at, status_changed_at")
              .eq("opportunity_id", opportunityId)
              .eq("participant_id", userId)
              .single();
            return data
              ? {
                  id: data.id as string,
                  status: mapMatchingStatus(data.status as string),
                  message: (data.message as string) ?? null,
                  created_at: (data.applied_at as string) ?? "",
                  completed_at:
                    data.status === "completed"
                      ? (data.status_changed_at as string)
                      : null,
                }
              : null;
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null);
    const bookmarkPromise = userId
      ? prisma.engagementEvent
          .findFirst({
            where: { userId, opportunityId, event: "favorite" },
            select: { id: true },
          })
          .then(Boolean)
          .catch(() => false)
      : Promise.resolve(false);
    const [currentApplicants, existingApplication, isBookmarked] = await Promise.all([
      countPromise,
      applicationPromise,
      bookmarkPromise,
    ]);
    if (typeof currentApplicants === "number") opportunity.current_applicants = currentApplicants;
    if (userId) {
      after(async () => {
        try {
          await prisma.engagementEvent.create({
            data: { userId, opportunityId, event: "view", source: viewSource },
          });
        } catch (err) {
          console.error("[fetchOpportunityDetail] 閲覧イベントの記録に失敗:", err);
        }
      });
    }
    return { opportunity, existingApplication, isParticipant: participant, isBookmarked };
  } catch (err) {
    console.error("[fetchOpportunityDetail] 予期しないエラー:", err);
    return emptyDetail();
  }
}

function emptyDetail(): OpportunityDetailResult {
  return { opportunity: null, existingApplication: null, isParticipant: false, isBookmarked: false };
}
