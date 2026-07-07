import "server-only";

export type PersonaKey =
  | "participant-fresh"
  | "participant-onboarded"
  | "participant-diagnosis"
  | "participant-lifecycle"
  | "participant-delete"
  | "user-suspendable"
  | "organization-approved"
  | "organization-pending"
  | "organization-review-approve"
  | "organization-review-reject"
  | "admin"
  | "admin-review";

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
  "user-suspendable": {
    key: "user-suspendable",
    email: "e2e-user-suspendable@example.com",
    role: "participant",
    description: "admin-review の凍結/解除フロー専用（毎回 isActive=true に戻す）",
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
  "organization-review-approve": {
    key: "organization-review-approve",
    email: "e2e-org-review-approve@example.com",
    role: "organization",
    description: "管理者の審査詳細承認E2E専用（毎回 reviewStatus=pending に戻す）",
  },
  "organization-review-reject": {
    key: "organization-review-reject",
    email: "e2e-org-review-reject@example.com",
    role: "organization",
    description: "管理者の審査詳細否認E2E専用（毎回 reviewStatus=pending に戻す）",
  },
  admin: {
    key: "admin",
    email: "e2e-admin@example.com",
    role: "admin",
    description: "管理者ロール",
  },
  "admin-review": {
    key: "admin-review",
    email: "e2e-admin-review@example.com",
    role: "admin",
    description: "管理者の審査・凍結mutation E2E専用",
  },
};

function isPersonaKey(key: string): key is PersonaKey {
  return Object.prototype.hasOwnProperty.call(PERSONAS, key);
}

export function resolvePersona(key: string): Persona | null {
  return isPersonaKey(key) ? PERSONAS[key] : null;
}
