"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { BIG5Scores, QuestionAnswer } from "@/lib/personality/types";
import { PERSONALITY_TYPES } from "@/lib/personality/constants";
import {
  findClosestPersonalityType,
  calculateBIG5Diagnosis,
} from "@/lib/personality/logic";
import type { DiagnosisResultData, SubmitDiagnosisResult } from "./types";

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

    const participant = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { diagnosisType: true, diagnosisScores: true },
    });

    if (!participant) {
      return null;
    }

    const rawScores = participant.diagnosisScores;
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

    // diagnosisType が PERSONALITY_TYPES に存在するか確認
    const diagnosisType = participant.diagnosisType;
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

/**
 * 診断結果を DB に保存する
 *
 * - 回答データから BIG5 スコアを計算（既存 logic.ts を利用）
 * - participants.diagnosis_type に 10類型の結果ID を保存
 * - participants.diagnosis_scores に BIG5 スコア（JSONB）を保存
 */
export async function submitDiagnosis(
  answers: QuestionAnswer[]
): Promise<SubmitDiagnosisResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "ログインが必要です" };
    }

    // 参加者であることを確認
    const participant = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!participant) {
      return { success: false, error: "参加者登録が必要です" };
    }

    // 回答データから BIG5 スコアを計算
    const profile = await calculateBIG5Diagnosis(answers);

    // 人物タイプ ID を決定（完全一致 or 近似一致）
    const diagnosisType = profile.personalityType
      ? profile.personalityType.id
      : profile.closestType.id;

    // DB に保存
    await prisma.participantProfile.update({
      where: { userId: user.id },
      data: {
        diagnosisType: diagnosisType,
        diagnosisScores: profile.scores,
      },
    });

    return { success: true };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[submitDiagnosis] 予期しないエラー:", err);
    }
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}
