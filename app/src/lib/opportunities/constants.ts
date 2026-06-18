/**
 * 募集案件の選択肢定数
 *
 * 作成・編集フォーム、おすすめフィルタ、Server Action の validation で共用する。
 * フォームとフィルタの選択肢を一致させ、案件レベルのデータ整合性を保つ。
 */

/** 参加形態（DB enum: participation_mode に対応） */
export type ParticipationMode = "online" | "offline" | "hybrid";

/** カテゴリの選択肢 */
export const CATEGORY_OPTIONS = [
  "環境保全",
  "地域活動",
  "教育",
  "子ども支援",
  "居場所づくり",
  "IT支援",
  "高齢者支援",
  "障がい者サポート",
] as const;

/** 参加形態の選択肢（value と日本語ラベル） */
export const PARTICIPATION_MODE_OPTIONS = [
  { value: "online", label: "オンライン" },
  { value: "offline", label: "オフライン（対面）" },
  { value: "hybrid", label: "ハイブリッド" },
] as const;

/** 値が有効なカテゴリか判定する */
export function isValidCategory(value: string): boolean {
  return (CATEGORY_OPTIONS as readonly string[]).includes(value);
}

/** 値が有効な参加形態か判定する */
export function isValidParticipationMode(
  value: string
): value is ParticipationMode {
  return value === "online" || value === "offline" || value === "hybrid";
}
