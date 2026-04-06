/** 参加者プロフィール登録フォームのデータ */
export interface RegisterParticipantData {
  name: string;
  /** 希望地域（任意） */
  region?: string;
}

/** 参加者プロフィール登録の結果 */
export interface RegisterParticipantResult {
  success: boolean;
  error?: string;
}
