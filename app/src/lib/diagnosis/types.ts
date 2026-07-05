/**
 * 診断 Server Actions 関連の型定義
 */

import type {
  ActivityStyleType,
  DiagnosisAnswer,
  DomainScores,
  QualityFlag,
} from "@/lib/diagnosis-scale/types";

/** submitDiagnosis の入力 */
export interface SubmitDiagnosisInput {
  answers: DiagnosisAnswer[];
  /** 診断全体の所要時間（ミリ秒）。回答品質判定に使用 */
  totalDurationMs?: number;
  /** 中断からの再開回数 */
  resumedCount?: number;
  /** 生回答の保存への同意。false の場合は集計結果のみ保存する */
  consentToStoreResponses: boolean;
}

/** submitDiagnosis の戻り値 */
export interface SubmitDiagnosisResult {
  success: boolean;
  error?: string;
}

/** fetchDiagnosisResult の戻り値 */
export interface DiagnosisResultData {
  /** 表示用スコア (0-100)。回答の線形変換であり、母集団内の位置ではない */
  scaledScores: DomainScores;
  /** raw score（ドメインごとの項目合計 10-50） */
  rawScores: DomainScores;
  scaleCode: string;
  scaleVersion: string;
  /** 診断実施日時（ISO 8601） */
  answeredAt: string;
  /** 回答品質フラグ（空配列 = 特記事項なし） */
  qualityFlags: QualityFlag[];
  /** 活動スタイルの参考タイプ（補助情報） */
  styleType: ActivityStyleType | null;
}
