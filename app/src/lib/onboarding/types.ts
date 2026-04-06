/**
 * オンボーディング関連の型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - users: ロール管理
 * - participants: 参加者プロフィール
 * - organizations: 団体プロフィール
 */

/** ユーザーのロール */
export type UserRole = "participant" | "organization";

/** 参加者プロフィール登録フォームデータ */
export interface ParticipantFormData {
  name: string;
  region: string;
}

/** 団体プロフィール登録フォームデータ */
export interface OrganizationFormData {
  name: string;
  description: string;
  line_id: string;
  contact_email: string;
}

/** 登録アクションの戻り値 */
export interface RegisterResult {
  success: boolean;
  error?: string;
}

/** ユーザーのオンボーディング状態 */
export interface OnboardingStatus {
  /** ロールが設定されているか */
  hasRole: boolean;
  role: UserRole | null;
  /** プロフィールが登録済みか */
  hasProfile: boolean;
  /** 団体の場合の審査ステータス */
  organizationStatus: "pending" | "approved" | "rejected" | null;
}
