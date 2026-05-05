"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { BIG5Scores, DiagnosisMode, QuestionAnswer } from "@/lib/personality/types";
import {
  DEFAULT_DIAGNOSIS_MODE,
  getQuestionsForMode,
  isDiagnosisMode,
  PERSONALITY_TYPES,
} from "@/lib/personality/constants";
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
 * 保存前に回答データが指定モードの全質問分そろっているか検証する
 */
function validateDiagnosisAnswers(
  answers: QuestionAnswer[],
  mode: DiagnosisMode
): string | null {
  const questions = getQuestionsForMode(mode);
  const expectedQuestionIds = new Set(questions.map((q) => q.id));

  if (answers.length !== questions.length) {
    return "すべての質問に回答してください";
  }

  const seen = new Set<string>();
  for (const answer of answers) {
    if (!expectedQuestionIds.has(answer.questionId)) {
      return "回答データが不正です";
    }
    if (seen.has(answer.questionId)) {
      return "回答データが不正です";
    }
    if (!Number.isInteger(answer.value) || answer.value < 1 || answer.value > 5) {
      return "回答データが不正です";
    }
    seen.add(answer.questionId);
  }

  return null;
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
      select: { diagnosisType: true, diagnosisScores: true, diagnosisMode: true },
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
    const rawDiagnosisMode = participant.diagnosisMode ?? undefined;
    const diagnosisMode = isDiagnosisMode(rawDiagnosisMode)
      ? rawDiagnosisMode
      : DEFAULT_DIAGNOSIS_MODE;

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
        diagnosisMode,
      };
    }

    // 完全一致しない場合は最も近いタイプを計算
    const closestType = findClosestPersonalityType(scores);
    return {
      personalityType: closestType,
      scores,
      isExactMatch: false,
      diagnosisMode,
    };
  } catch (err) {
    const errorDetail =
      err instanceof Error
        ? { name: err.constructor.name, message: err.message, code: (err as unknown as Record<string, unknown>).code }
        : { raw: String(err) };
    console.error("[fetchDiagnosisResult] 予期しないエラー:", JSON.stringify(errorDetail));
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
  answers: QuestionAnswer[],
  mode: DiagnosisMode = DEFAULT_DIAGNOSIS_MODE
): Promise<SubmitDiagnosisResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "ログインが必要です" };
    }

    const validationError = validateDiagnosisAnswers(answers, mode);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // 参加者であることを確認
    console.log("[submitDiagnosis] step:findUnique userId=", user.id);
    const participant = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!participant) {
      console.warn("[submitDiagnosis] 参加者レコードが存在しない userId=", user.id);
      return { success: false, error: "参加者登録が必要です" };
    }

    // 回答データから BIG5 スコアを計算
    console.log("[submitDiagnosis] step:calculate answers=", answers.length);
    const profile = await calculateBIG5Diagnosis(answers, mode);

    // 人物タイプ ID を決定（完全一致 or 近似一致）
    const diagnosisType = profile.personalityType
      ? profile.personalityType.id
      : profile.closestType.id;

    const scoresJson = profile.scores as unknown as Prisma.InputJsonValue;
    const closestTypeDistance = profile.personalityType
      ? null
      : profile.closestType.distance;

    // DB に保存（最新結果と履歴を同一トランザクションで永続化）
    console.log("[submitDiagnosis] step:transaction diagnosisType=", diagnosisType);
    await prisma.$transaction(async (tx) => {
      const personalityType = await tx.personalityType.findUnique({
        where: { typeId: diagnosisType },
        select: { id: true },
      });

      await tx.participantProfile.update({
        where: { userId: user.id },
        data: {
          diagnosisType: diagnosisType,
          diagnosisScores: scoresJson,
          diagnosisMode: mode,
        },
      });

      await tx.diagnosisResult.create({
        data: {
          userId: user.id,
          personalityTypeId: personalityType?.id ?? null,
          big5Scores: scoresJson,
          diagnosisMode: mode,
          closestTypeDistance,
        },
      });
    });

    console.log("[submitDiagnosis] 保存成功");
    return { success: true };
  } catch (err) {
    const errorDetail =
      err instanceof Error
        ? { name: err.constructor.name, message: err.message, code: (err as unknown as Record<string, unknown>).code }
        : { raw: String(err) };
    console.error("[submitDiagnosis] 予期しないエラー:", JSON.stringify(errorDetail));
    console.error("[submitDiagnosis] stack:", err instanceof Error ? err.stack : "N/A");
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}
