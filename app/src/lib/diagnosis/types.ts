/**
 * 診断結果ページ関連の型定義
 *
 * participants テーブルの diagnosis_type / diagnosis_scores を参照し、
 * 既存の PersonalityType 定数から詳細情報を引き当てる。
 */

import type { BIG5Scores, PersonalityType } from "@/lib/personality/types";

/** DB から取得した診断結果の生データ */
export interface DiagnosisRawData {
  diagnosis_type: string | null;
  diagnosis_scores: Record<string, number> | null;
}

/** fetchDiagnosisResult の戻り値 */
export interface DiagnosisResultData {
  /** 判定された人物タイプ（PERSONALITY_TYPES から引き当て） */
  personalityType: PersonalityType;
  /** BIG5 スコア（0-100） */
  scores: BIG5Scores;
  /** 完全一致か近似一致か */
  isExactMatch: boolean;
}
