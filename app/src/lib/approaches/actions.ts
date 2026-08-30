"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import { APPROACH_MESSAGE_MAX_LENGTH } from "./constants";
import {
  fetchApproachSendDataQuery,
  fetchDashboardApproachesQuery,
  fetchMyApproachDetailQuery,
  fetchMyApproachesQuery,
} from "./queries";
import type {
  ApproachMutationResult,
  ApproachParticipant,
  ApproachResponse,
  ApproachSendDataResult,
  ApproachStatus,
  ApproachableParticipantsResult,
  DashboardApproachesResult,
  MyApproachDetailResult,
  MyApproachesResult,
} from "./types";

const APPROACH_EXPIRATION_DAYS = 14;
const APPROACH_DAILY_SEND_LIMIT = 20;
const PARTICIPANT_ACTIVE_APPROACH_LIMIT = 10;

interface ApprovedOrganization {
  id: string;
  organizationName: string;
  contactEmail: string | null;
  contactLineId: string | null;
  contactLineUrl: string | null;
}

interface ParticipantRecord {
  id: string;
  userId: string;
  name: string;
  region: string;
  bio: string | null;
  interests: unknown;
  preferredLocation: string | null;
  publicProfile: boolean;
  latestDiagnosisResult: { styleTypeId: string | null } | null;
}

async function getCurrentUserId(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "ログインが必要です" };
  }

  return { userId: user.id };
}

async function fetchApprovedOrganizationProfile(
  userId: string
): Promise<ApprovedOrganization | { error: string }> {
  const organization = await prisma.organizationProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      organizationName: true,
      reviewStatus: true,
      contactEmail: true,
      contactLineId: true,
      contactLineUrl: true,
    },
  });

  if (!organization) {
    return { error: "団体プロフィールが見つかりません" };
  }

  if (organization.reviewStatus !== "approved") {
    return { error: "承認済み団体のみ利用できます" };
  }

  return {
    id: organization.id,
    organizationName: organization.organizationName,
    contactEmail: organization.contactEmail,
    contactLineId: organization.contactLineId,
    contactLineUrl: organization.contactLineUrl,
  };
}

async function fetchParticipantProfileByUserId(
  userId: string
): Promise<{ id: string } | { error: string }> {
  const participant = await prisma.participantProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!participant) {
    return { error: "参加者プロフィールが見つかりません" };
  }

  return participant;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toApproachStatus(value: string): ApproachStatus {
  if (value === "accepted" || value === "declined") return value;
  return "sent";
}

function isApproachExpired(
  status: ApproachStatus,
  expiresAt: Date | string,
  now = new Date()
): boolean {
  return status === "sent" && new Date(expiresAt).getTime() < now.getTime();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function mapParticipant(participant: ParticipantRecord): ApproachParticipant {
  const styleTypeId = participant.latestDiagnosisResult?.styleTypeId ?? null;
  return {
    id: participant.id,
    name: participant.name,
    region: participant.region,
    bio: participant.bio,
    interests: toStringArray(participant.interests),
    preferredLocation: participant.preferredLocation,
    styleTypeLabel: styleTypeId
      ? (findStyleTypeById(styleTypeId)?.name ?? null)
      : null,
  };
}

export async function fetchApproachableParticipants(): Promise<ApproachableParticipantsResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { participants: [], error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { participants: [], error: organization.error };
    }

    const participants = await prisma.participantProfile.findMany({
      where: { publicProfile: true },
      select: {
        id: true,
        userId: true,
        name: true,
        region: true,
        bio: true,
        interests: true,
        preferredLocation: true,
        publicProfile: true,
        latestDiagnosisResult: { select: { styleTypeId: true } },
        approaches: {
          where: { organizationId: organization.id },
          select: { id: true },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return {
      participants: participants.map((participant) => ({
        ...mapParticipant(participant),
        sentApproachCount: participant.approaches.length,
      })),
    };
  } catch (err) {
    console.error("[fetchApproachableParticipants] 予期しないエラー:", err);
    return { participants: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchApproachSendData(
  participantProfileId: string
): Promise<ApproachSendDataResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) {
      return {
        participant: null,
        opportunities: [],
        templates: [],
        error: auth.error,
      };
    }
    return fetchApproachSendDataQuery(auth.userId, participantProfileId);
  } catch (err) {
    console.error("[fetchApproachSendData] 予期しないエラー:", err);
    return {
      participant: null,
      opportunities: [],
      templates: [],
      error: "予期しないエラーが発生しました",
    };
  }
}

export async function saveApproachTemplate(input: {
  name: string;
  body: string;
}): Promise<ApproachMutationResult & { templateId?: string }> {
  const name = input.name.trim();
  const body = input.body.trim();

  if (!name) {
    return { success: false, error: "テンプレート名を入力してください" };
  }
  if (!body) {
    return { success: false, error: "テンプレート本文を入力してください" };
  }
  if (body.length > APPROACH_MESSAGE_MAX_LENGTH) {
    return {
      success: false,
      error: "テンプレート本文は1000文字以内で入力してください",
    };
  }

  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { success: false, error: organization.error };
    }

    const template = await prisma.messageTemplate.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name,
        },
      },
      create: {
        organizationId: organization.id,
        name,
        body,
      },
      update: {
        body,
      },
      select: { id: true },
    });

    return { success: true, templateId: template.id };
  } catch (err) {
    console.error("[saveApproachTemplate] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function sendApproach(input: {
  participantProfileId: string;
  opportunityId: string;
  message: string;
}): Promise<ApproachMutationResult> {
  const message = input.message.trim();
  if (!message) {
    return {
      success: false,
      error: "アプローチ文を入力してください",
    };
  }

  if (message.length > APPROACH_MESSAGE_MAX_LENGTH) {
    return {
      success: false,
      error: "アプローチ文は1000文字以内で入力してください",
    };
  }

  try {
    const now = new Date();
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { success: false, error: organization.error };
    }

    const participant = await prisma.participantProfile.findUnique({
      where: { id: input.participantProfileId },
      select: {
        id: true,
        userId: true,
        name: true,
        region: true,
        bio: true,
        interests: true,
        preferredLocation: true,
        publicProfile: true,
        latestDiagnosisResult: { select: { styleTypeId: true } },
      },
    });

    if (!participant || !participant.publicProfile) {
      return { success: false, error: "参加者が見つかりません" };
    }

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: input.opportunityId,
        organizationId: organization.id,
        status: "published",
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!opportunity) {
      return {
        success: false,
        error: "公開中の自団体案件が見つかりません",
      };
    }

    const existing = await prisma.approach.findFirst({
      where: {
        organizationId: organization.id,
        participantProfileId: participant.id,
        opportunityId: opportunity.id,
      },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        error: "この参加者にはこの案件ですでにアプローチ済みです",
      };
    }

    const dailySentCount = await prisma.approach.count({
      where: {
        organizationId: organization.id,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });

    if (dailySentCount >= APPROACH_DAILY_SEND_LIMIT) {
      return {
        success: false,
        error: "1日に送信できるアプローチ数の上限に達しました",
      };
    }

    const activeReceivedCount = await prisma.approach.count({
      where: {
        participantProfileId: participant.id,
        status: "sent",
        expiresAt: { gt: now },
      },
    });

    if (activeReceivedCount >= PARTICIPANT_ACTIVE_APPROACH_LIMIT) {
      return {
        success: false,
        error: "この参加者は未回答のアプローチが多いため、現在は送信できません",
      };
    }

    const created = await prisma.approach.create({
      data: {
        organizationId: organization.id,
        participantProfileId: participant.id,
        opportunityId: opportunity.id,
        message,
        expiresAt: addDays(now, APPROACH_EXPIRATION_DAYS),
      },
      select: { id: true },
    });

    return { success: true, approachId: created.id };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return {
        success: false,
        error: "この参加者にはこの案件ですでにアプローチ済みです",
      };
    }

    console.error("[sendApproach] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function fetchDashboardApproaches(): Promise<DashboardApproachesResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { approaches: [], error: auth.error };
    return fetchDashboardApproachesQuery(auth.userId);
  } catch (err) {
    console.error("[fetchDashboardApproaches] 予期しないエラー:", err);
    return { approaches: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchMyApproaches(): Promise<MyApproachesResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { approaches: [], error: auth.error };
    return fetchMyApproachesQuery(auth.userId);
  } catch (err) {
    console.error("[fetchMyApproaches] 予期しないエラー:", err);
    return { approaches: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchMyApproachDetail(
  approachId: string
): Promise<MyApproachDetailResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { approach: null, error: auth.error };
    return fetchMyApproachDetailQuery(auth.userId, approachId);
  } catch (err) {
    console.error("[fetchMyApproachDetail] 予期しないエラー:", err);
    return { approach: null, error: "予期しないエラーが発生しました" };
  }
}

export async function respondToApproach(
  approachId: string,
  response: ApproachResponse
): Promise<ApproachMutationResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const participant = await fetchParticipantProfileByUserId(auth.userId);
    if ("error" in participant) {
      return { success: false, error: participant.error };
    }

    const approach = await prisma.approach.findFirst({
      where: {
        id: approachId,
        participantProfileId: participant.id,
      },
      select: { id: true, status: true, expiresAt: true },
    });

    if (!approach) {
      return { success: false, error: "アプローチが見つかりません" };
    }

    if (approach.status !== "sent") {
      return {
        success: false,
        error: "このアプローチはすでに回答済みです",
      };
    }

    if (isApproachExpired(toApproachStatus(approach.status), approach.expiresAt)) {
      return {
        success: false,
        error: "このアプローチの回答期限は過ぎています",
      };
    }

    const updated = await prisma.approach.update({
      where: { id: approach.id },
      data: {
        status: response,
        respondedAt: new Date(),
      },
      select: { id: true },
    });

    return { success: true, approachId: updated.id };
  } catch (err) {
    console.error("[respondToApproach] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}
