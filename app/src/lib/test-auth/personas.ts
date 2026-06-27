import "server-only";

export type PersonaKey =
  | "participant-fresh"
  | "participant-onboarded"
  | "participant-suspendable"
  | "organization-approved"
  | "organization-pending"
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
  "participant-suspendable": {
    key: "participant-suspendable",
    email: "e2e-participant-suspendable@example.com",
    role: "participant",
    description: "admin の凍結/解除フロー専用（毎回 isActive=true に戻す）",
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
