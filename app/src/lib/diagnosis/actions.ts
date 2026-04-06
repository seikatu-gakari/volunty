"use server";

import { createClient } from "@/lib/supabase/server";
import type { BIG5Scores } from "@/lib/personality/types";
import { PERSONALITY_TYPES } from "@/lib/personality/constants";
import { findClosestPersonalityType } from "@/lib/personality/logic";
import type { DiagnosisResultData } from "./types";

const BIG5_TRAIT_KEYS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
] as const;

/**
 * 未知の値が BIG5Scores 型かどうかを実行時に検証するタイプガード
 */
function isBIG5Scores(value: unknown): value is BIG5Scores {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return BIG5_TRAIT_KEYS.every((t) => typeof obj[t] === "number");
}

/**
 * ログインユーザーの診断結果を取得する
 *
 * - participants.diagnosis_type → PERSONALITY_TYPES から詳細を引き当て
 * - participants.diagnosis_scores → BIG5Scores として返す
 * - 未ログイン/未診断/データ不正の場合は null を返す
 */
export async function fetchDiagnosisResult(): Promise<DiagnosisResultData | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: participant } = await supabase
      .from("participants")
      .select("diagnosis_type, diagnosis_scores")
      .eq("id", user.id)
      .single();

    if (!participant) {
      return null;
    }

    const rawScores = participant.diagnosis_scores;
    if (!isBIG5Scores(rawScores)) {
      return null;
    }

    const scores: BIG5Scores = {
      extraversion: rawScores.extraversion,
      agreeableness: rawScores.agreeableness,
      conscientiousness: rawScores.conscientiousness,
      neuroticism: rawScores.neuroticism,
      openness: rawScores.openness,
    };

    // diagnosis_type が PERSONALITY_TYPES に存在するか確認
    const diagnosisType = participant.diagnosis_type;
    const exactType = diagnosisType
      ? PERSONALITY_TYPES.find((t) => t.id === diagnosisType) ?? null
      : null;

    if (exactType) {
      return {
        personalityType: exactType,
        scores,
        isExactMatch: true,
      };
    }

    // 完全一致しない場合は最も近いタイプを計算
    const closestType = findClosestPersonalityType(scores);
    return {
      personalityType: closestType,
      scores,
      isExactMatch: false,
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fetchDiagnosisResult] 予期しないエラー:", err);
    }
    return null;
  }
}
