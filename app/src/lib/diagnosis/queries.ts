import "server-only";

import { prisma } from "@/lib/prisma";
import { isDomainScores } from "@/lib/diagnosis-scale/scoring";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import type { QualityFlag } from "@/lib/diagnosis-scale/types";
import type { DiagnosisResultData } from "./types";

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

/** 検証済みの参加者 userId の最新診断結果を取得する。 */
export async function fetchDiagnosisResultQuery(
  userId: string
): Promise<DiagnosisResultData | null> {
  try {
    const participant = await prisma.participantProfile.findUnique({
      where: { userId },
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
    if (!result) return null;
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
  } catch (error) {
    const errorDetail =
      error instanceof Error
        ? { name: error.constructor.name, message: error.message }
        : { raw: String(error) };
    console.error(
      "[fetchDiagnosisResultQuery] 予期しないエラー:",
      JSON.stringify(errorDetail)
    );
    return null;
  }
}
