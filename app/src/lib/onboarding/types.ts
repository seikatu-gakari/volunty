/** 団体プロフィール登録フォームのデータ */
export interface RegisterOrganizationData {
  // Step 1: 基本情報（必須）
  organizationName: string;
  representativeName: string;
  contactEmail: string;
  activityAreas: string[];
  // Step 2: 団体の魅力（任意）
  description?: string;
  activityCategories?: string[];
  websiteUrl?: string;
  logoUrl?: string;
  // Step 3: 連絡手段
  contactLineId: string;
  contactLineUrl?: string;
}

/** 団体プロフィール登録の結果 */
export interface RegisterOrganizationResult {
  success: boolean;
  error?: string;
}

/** 参加者プロフィール登録フォームのデータ */
export interface RegisterParticipantData {
  name: string;
  /** 生年月日 (YYYY-MM-DD形式) */
  birthday: string;
  /** 性別（任意）: male / female / other / undisclosed */
  gender?: string;
  /** お住まいの都道府県（必須） */
  region: string;
  /** 自己紹介（任意） */
  bio?: string;
  /** 興味のある分野（任意・複数選択可） */
  interests?: string[];
}

/** 参加者プロフィール登録の結果 */
export interface RegisterParticipantResult {
  success: boolean;
  error?: string;
}
