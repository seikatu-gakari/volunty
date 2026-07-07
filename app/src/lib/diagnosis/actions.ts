"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  NORMS_VERSION,
  SCORING_ALGORITHM_VERSION,
  getScaleDefinition,
} from "@/lib/diagnosis-scale/scale";
import { scoreDiagnosis, isDomainScores } from "@/lib/diagnosis-scale/scoring";
import {
  assessResponseQuality,
  QUALITY_RULE_VERSION,
} from "@/lib/diagnosis-scale/quality";
import {
  findClosestStyleType,
  findStyleTypeById,
  STYLE_TYPE_VERSION,
} from "@/lib/diagnosis-scale/style-types";
import type { QualityFlag } from "@/lib/diagnosis-scale/types";
import type {
  DiagnosisResultData,
  SubmitDiagnosisInput,
  SubmitDiagnosisResult,
} from "./types";

const QUALITY_FLAGS: readonly QualityFlag[] = [
  "too_fast",
  "straight_lining",
  "inconsistent",
] as const;

function toQualityFlags(value: unknown): QualityFlag[] {
  if (!Array.isArray(value)) return [];
  return value.filter((flag): flag is QualityFlag =>
    (QUALITY_FLAGS as readonly string[]).includes(flag as string)
  );
}

/**
 * ログインユーザーの最新の診断結果を取得する
 *
 * - m_participant_profile.latest_diagnosis_result_id → t_diagnosis_result を参照
 * - 未ログイン / 未診断 / データ不正の場合は null を返す
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
      select: {
        latestDiagnosisResult: {
          select: {
            scaleCode: true,
            scaleVersion: true,
            rawScores: true,
            scaledScores: true,
            styleTypeId: true,
            qualityFlags: true,
            answeredAt: true,
          },
        },
      },
    });

    const result = participant?.latestDiagnosisResult;
    if (!result) {
      return null;
    }

    if (!isDomainScores(result.scaledScores) || !isDomainScores(result.rawScores)) {
      return null;
    }

    return {
      scaledScores: result.scaledScores,
      rawScores: result.rawScores,
      scaleCode: result.scaleCode,
      scaleVersion: result.scaleVersion,
      answeredAt: result.answeredAt.toISOString(),
      qualityFlags: toQualityFlags(result.qualityFlags),
      styleType: result.styleTypeId
        ? (findStyleTypeById(result.styleTypeId) ?? null)
        : null,
    };
  } catch (err) {
    const errorDetail =
      err instanceof Error
        ? { name: err.constructor.name, message: err.message }
        : { raw: String(err) };
    console.error("[fetchDiagnosisResult] 予期しないエラー:", JSON.stringify(errorDetail));
    return null;
  }
}

/**
 * 診断結果を DB に保存する
 *
 * - 回答から純粋関数で採点（尺度・採点・標準化・タイプ定義の各バージョンを記録）
 * - 回答品質を性格スコアとは別のメタデータとして判定・保存
 * - 生回答は常に t_diagnosis_response へ保存する（アカウント削除で連鎖削除）
 * - m_participant_profile.latest_diagnosis_result_id を最新結果へ更新
 */
export async function submitDiagnosis(
  input: SubmitDiagnosisInput
): Promise<SubmitDiagnosisResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "ログインが必要です" };
    }

    // 採点（バリデーション込み・決定的）
    const scale = getScaleDefinition(input.mode ?? "full");
    const scoring = scoreDiagnosis(input.answers, scale);
    if (!scoring.success) {
      return { success: false, error: scoring.message };
    }

    // 参加者であることを確認
    const participant = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!participant) {
      return { success: false, error: "参加者登録が必要です" };
    }

    // 回答品質（スコアには影響しない参考情報）
    const quality = assessResponseQuality(
      input.answers,
      { totalDurationMs: input.totalDurationMs },
      scale
    );

    // 活動スタイルの参考タイプ（補助情報）
    const styleType = findClosestStyleType(scoring.score.scaledScores);

    await prisma.$transaction(async (tx) => {
      const created = await tx.diagnosisResult.create({
        data: {
          userId: user.id,
          scaleCode: scoring.score.scaleCode,
          scaleVersion: scoring.score.scaleVersion,
          scoringAlgorithmVersion: SCORING_ALGORITHM_VERSION,
          normsVersion: NORMS_VERSION,
          styleTypeVersion: STYLE_TYPE_VERSION,
          qualityRuleVersion: QUALITY_RULE_VERSION,
          rawScores: scoring.score.rawScores as unknown as Prisma.InputJsonValue,
          scaledScores: scoring.score.scaledScores as unknown as Prisma.InputJsonValue,
          styleTypeId: styleType.type.id,
          qualityFlags: quality.flags,
          totalDurationMs: input.totalDurationMs ?? null,
          resumedCount: input.resumedCount ?? 0,
        },
        select: { id: true },
      });

      await tx.diagnosisResponse.createMany({
        data: input.answers.map((answer) => ({
          diagnosisResultId: created.id,
          itemCode: answer.itemCode,
          value: answer.value,
          elapsedMs: answer.elapsedMs ?? null,
          changedCount: answer.changedCount ?? null,
        })),
      });

      await tx.participantProfile.update({
        where: { userId: user.id },
        data: { latestDiagnosisResultId: created.id },
      });
    });

    return { success: true };
  } catch (err) {
    const errorDetail =
      err instanceof Error
        ? { name: err.constructor.name, message: err.message }
        : { raw: String(err) };
    console.error("[submitDiagnosis] 予期しないエラー:", JSON.stringify(errorDetail));
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}
