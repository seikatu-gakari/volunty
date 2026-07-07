import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface RawParticipantProfile {
  id: string;
  user_id: string;
  name: string;
  birthday: string | Date;
  gender: string | null;
  region: string;
  bio: string | null;
  interests: unknown;
  latest_diagnosis_result_id: string | null;
  updated_at: string | null;
}

/** 最新診断のサマリ（マイページ表示用。生スコアは含めない） */
export interface LatestDiagnosisSummary {
  styleTypeId: string | null;
  answeredAt: Date;
}

export interface ParticipantProfileRecord {
  id: string;
  userId: string;
  name: string;
  birthday: Date;
  gender: string | null;
  region: string;
  bio: string | null;
  interests: string[];
  latestDiagnosis: LatestDiagnosisSummary | null;
  updatedAt: Date | null;
}

export interface ParticipantProfileFetchDebug {
  fallbackUsed: boolean;
  prismaErrorDetail: string | null;
  supabaseErrorDetail: string | null;
}

export interface ParticipantProfileFetchResult {
  profile: ParticipantProfileRecord | null;
  debug: ParticipantProfileFetchDebug;
}

function toInterests(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((interest): interest is string => typeof interest === "string")
    : [];
}

function formatErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const maybeCode = (error as { code?: unknown }).code;
  const codeText = typeof maybeCode === "string" ? ` (code: ${maybeCode})` : "";
  return `${error.name}: ${error.message}${codeText}`;
}

export async function fetchParticipantProfileByUserIdWithDebug(
  userId: string
): Promise<ParticipantProfileFetchResult> {
  let prismaErrorDetail: string | null = null;

  try {
    const profile = await prisma.participantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        name: true,
        birthday: true,
        gender: true,
        region: true,
        bio: true,
        interests: true,
        updatedAt: true,
        latestDiagnosisResult: {
          select: { styleTypeId: true, answeredAt: true },
        },
      },
    });

    if (profile) {
      return {
        profile: {
          id: profile.id,
          userId: profile.userId,
          name: profile.name,
          birthday: profile.birthday,
          gender: profile.gender,
          region: profile.region,
          bio: profile.bio,
          interests: toInterests(profile.interests),
          latestDiagnosis: profile.latestDiagnosisResult
            ? {
                styleTypeId: profile.latestDiagnosisResult.styleTypeId,
                answeredAt: profile.latestDiagnosisResult.answeredAt,
              }
            : null,
          updatedAt: profile.updatedAt,
        },
        debug: {
          fallbackUsed: false,
          prismaErrorDetail: null,
          supabaseErrorDetail: null,
        },
      };
    }
  } catch (err) {
    prismaErrorDetail = formatErrorDetail(err);
    console.error(
      "[fetchParticipantProfileByUserId] Prisma 取得に失敗したため Supabase にフォールバックします:",
      err
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("m_participant_profile")
      .select(
        "id, user_id, name, birthday, gender, region, bio, interests, latest_diagnosis_result_id, updated_at"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      const supabaseErrorDetail = formatErrorDetail(error);
      console.error(
        "[fetchParticipantProfileByUserId] Supabase 取得に失敗しました:",
        error
      );
      return {
        profile: null,
        debug: {
          fallbackUsed: true,
          prismaErrorDetail,
          supabaseErrorDetail,
        },
      };
    }

    if (!data) {
      return {
        profile: null,
        debug: {
          fallbackUsed: prismaErrorDetail !== null,
          prismaErrorDetail,
          supabaseErrorDetail: null,
        },
      };
    }

    const raw = data as RawParticipantProfile;
    const birthday =
      raw.birthday instanceof Date ? raw.birthday : new Date(raw.birthday);
    if (Number.isNaN(birthday.getTime())) {
      return {
        profile: null,
        debug: {
          fallbackUsed: prismaErrorDetail !== null,
          prismaErrorDetail,
          supabaseErrorDetail: null,
        },
      };
    }

    // 最新診断のサマリも Supabase から取得する
    let latestDiagnosis: LatestDiagnosisSummary | null = null;
    if (raw.latest_diagnosis_result_id) {
      const { data: diagnosisData } = await supabase
        .from("t_diagnosis_result")
        .select("style_type_id, answered_at")
        .eq("id", raw.latest_diagnosis_result_id)
        .maybeSingle();
      if (diagnosisData) {
        latestDiagnosis = {
          styleTypeId: (diagnosisData.style_type_id as string | null) ?? null,
          answeredAt: new Date(diagnosisData.answered_at as string),
        };
      }
    }

    return {
      profile: {
        id: raw.id,
        userId: raw.user_id,
        name: raw.name,
        birthday,
        gender: raw.gender,
        region: raw.region,
        bio: raw.bio,
        interests: toInterests(raw.interests),
        latestDiagnosis,
        updatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
      },
      debug: {
        fallbackUsed: prismaErrorDetail !== null,
        prismaErrorDetail,
        supabaseErrorDetail: null,
      },
    };
  } catch (err) {
    const supabaseErrorDetail = formatErrorDetail(err);
    console.error(
      "[fetchParticipantProfileByUserId] フォールバック取得に失敗しました:",
      err
    );
    return {
      profile: null,
      debug: {
        fallbackUsed: true,
        prismaErrorDetail,
        supabaseErrorDetail,
      },
    };
  }
}

export async function fetchParticipantProfileByUserId(
  userId: string
): Promise<ParticipantProfileRecord | null> {
  const result = await fetchParticipantProfileByUserIdWithDebug(userId);
  return result.profile;
}
