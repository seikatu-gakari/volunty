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
  diagnosis_type: string | null;
  diagnosis_scores: unknown;
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
  diagnosisType: string | null;
  diagnosisScores: Record<string, number> | null;
}

function isScoreRecord(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "number");
}

function mapProfile(profile: RawParticipantProfile): ParticipantProfileRecord | null {
  const birthday =
    profile.birthday instanceof Date
      ? profile.birthday
      : new Date(profile.birthday);

  if (Number.isNaN(birthday.getTime())) {
    return null;
  }

  return {
    id: profile.id,
    userId: profile.user_id,
    name: profile.name,
    birthday,
    gender: profile.gender,
    region: profile.region,
    bio: profile.bio,
    interests: Array.isArray(profile.interests)
      ? profile.interests.filter(
          (interest): interest is string => typeof interest === "string"
        )
      : [],
    diagnosisType: profile.diagnosis_type,
    diagnosisScores: isScoreRecord(profile.diagnosis_scores)
      ? profile.diagnosis_scores
      : null,
  };
}

export async function fetchParticipantProfileByUserId(
  userId: string
): Promise<ParticipantProfileRecord | null> {
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
        diagnosisType: true,
        diagnosisScores: true,
      },
    });

    if (profile) {
      return {
        id: profile.id,
        userId: profile.userId,
        name: profile.name,
        birthday: profile.birthday,
        gender: profile.gender,
        region: profile.region,
        bio: profile.bio,
        interests: Array.isArray(profile.interests)
          ? profile.interests.filter(
              (interest): interest is string => typeof interest === "string"
            )
          : [],
        diagnosisType: profile.diagnosisType,
        diagnosisScores: isScoreRecord(profile.diagnosisScores)
          ? profile.diagnosisScores
          : null,
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[fetchParticipantProfileByUserId] Prisma 取得に失敗したため Supabase にフォールバックします:",
        err
      );
    }
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("m_participant_profile")
      .select(
        "id, user_id, name, birthday, gender, region, bio, interests, diagnosis_type, diagnosis_scores"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[fetchParticipantProfileByUserId] Supabase 取得に失敗しました:",
          error
        );
      }
      return null;
    }

    if (!data) {
      return null;
    }

    return mapProfile(data as RawParticipantProfile);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[fetchParticipantProfileByUserId] フォールバック取得に失敗しました:",
        err
      );
    }
    return null;
  }
}