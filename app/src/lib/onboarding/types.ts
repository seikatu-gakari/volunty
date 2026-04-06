/** 参加者プロフィール登録フォームのデータ */
export interface RegisterParticipantData {
  name: string;
  region: string;
}

/** 参加者プロフィール登録の結果 */
export interface RegisterParticipantResult {
  success: boolean;
  error?: string;
}
