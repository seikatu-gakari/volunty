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
