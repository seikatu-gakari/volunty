import "server-only";

export type PersonaKey =
  | "participant-fresh"
  | "participant-onboarded"
  | "participant-diagnosis"
  | "participant-lifecycle"
  | "participant-delete"
  | "participant-logout"
  | "participant-suspendable"
  | "participant-suspended"
  | "organization-approved"
  | "organization-pending"
  | "organization-fresh"
  | "organization-reapply"
  | "organization-profile-review"
  | "organization-lifecycle"
  | "organization-foreign"
  | "organization-pending-readonly"
  | "organization-rejected"
  | "organization-secondary"
  | "admin";

export interface Persona {
  key: PersonaKey;
  email: string;
  /** m_user の role。Supabase Auth の role とは別。 */
  role: "participant" | "organization" | "admin";
  description: string;
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  "participant-fresh": {
    key: "participant-fresh",
    email: "e2e-participant-fresh@example.com",
    role: "participant",
    description: "auth のみ／オンボーディング未完了（新規登録直後を再現）",
  },
  "participant-onboarded": {
    key: "participant-onboarded",
    email: "e2e-participant-onboarded@example.com",
    role: "participant",
    description: "プロフィール＋診断済み参加者",
  },
  "participant-diagnosis": {
    key: "participant-diagnosis",
    email: "e2e-participant-diagnosis@example.com",
    role: "participant",
    description: "プロフィール登録済み／診断未実施の参加者",
  },
  "participant-lifecycle": {
    key: "participant-lifecycle",
    email: "e2e-participant-lifecycle@example.com",
    role: "participant",
    description: "応募・アプローチ・証明書フロー専用の参加者",
  },
  "participant-delete": {
    key: "participant-delete",
    email: "e2e-participant-delete@example.com",
    role: "participant",
    description: "アカウント物理削除フロー専用（seedで毎回再作成）",
  },
  "participant-logout": {
    key: "participant-logout",
    email: "e2e-participant-logout@example.com",
    role: "participant",
    description: "ログアウトによるセッション失効確認専用",
  },
  "participant-suspendable": {
    key: "participant-suspendable",
    email: "e2e-participant-suspendable@example.com",
    role: "participant",
    description: "admin の凍結/解除フロー専用（毎回 isActive=true に戻す）",
  },
  "participant-suspended": {
    key: "participant-suspended",
    email: "e2e-participant-suspended@example.com",
    role: "participant",
    description: "凍結済みユーザーの強制退出確認専用",
  },
  "organization-approved": {
    key: "organization-approved",
    email: "e2e-org-approved@example.com",
    role: "organization",
    description: "承認済み団体ユーザー",
  },
  "organization-pending": {
    key: "organization-pending",
    email: "e2e-org-pending@example.com",
    role: "organization",
    description: "審査待ち団体（毎回 reviewStatus=pending に戻す）",
  },
  "organization-fresh": {
    key: "organization-fresh",
    email: "e2e-org-fresh@example.com",
    role: "organization",
    description: "団体オンボーディング専用（seedで未登録へ戻す）",
  },
  "organization-reapply": {
    key: "organization-reapply",
    email: "e2e-org-reapply@example.com",
    role: "organization",
    description: "否認理由確認と再申請専用（seedでrejectedへ戻す）",
  },
  "organization-profile-review": {
    key: "organization-profile-review",
    email: "e2e-org-profile-review@example.com",
    role: "organization",
    description: "承認済みプロフィール編集後の再審査専用",
  },
  "organization-lifecycle": {
    key: "organization-lifecycle",
    email: "e2e-org-lifecycle@example.com",
    role: "organization",
    description: "案件・応募・アプローチ・証明書の変更専用",
  },
  "organization-foreign": {
    key: "organization-foreign",
    email: "e2e-org-foreign@example.com",
    role: "organization",
    description: "所有権境界用の別団体",
  },
  "organization-pending-readonly": {
    key: "organization-pending-readonly",
    email: "e2e-org-pending-readonly@example.com",
    role: "organization",
    description: "審査待ち境界の読み取り確認専用",
  },
  "organization-rejected": {
    key: "organization-rejected",
    email: "e2e-org-rejected@example.com",
    role: "organization",
    description: "否認済み団体",
  },
  "organization-secondary": {
    key: "organization-secondary",
    email: "e2e-org-secondary@example.com",
    role: "organization",
    description: "他団体所有データへのアクセス境界確認専用",
  },
  admin: {
    key: "admin",
    email: "e2e-admin@example.com",
    role: "admin",
    description: "管理者ロール",
  },
};

function isPersonaKey(key: string): key is PersonaKey {
  return Object.prototype.hasOwnProperty.call(PERSONAS, key);
}

export function resolvePersona(key: string): Persona | null {
  return isPersonaKey(key) ? PERSONAS[key] : null;
}
