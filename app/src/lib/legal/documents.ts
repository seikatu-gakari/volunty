/**
 * 公開文書の版と導線を一元管理する。
 * 同意履歴に保存する版もここから参照し、画面ごとの不一致を防ぐ。
 */
export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "2026-09-07",
  privacy: "2026-09-07",
} as const;

export const LEGAL_LAST_UPDATED = "2026年9月7日";

export const LEGAL_DOCUMENTS = {
  terms: {
    label: "利用規約",
    href: "/terms",
    version: LEGAL_DOCUMENT_VERSIONS.terms,
  },
  privacy: {
    label: "プライバシーポリシー",
    href: "/privacy",
    version: LEGAL_DOCUMENT_VERSIONS.privacy,
  },
  operator: {
    label: "運営者情報",
    href: "/operator",
  },
  contact: {
    label: "お問い合わせ",
    href: "/contact",
  },
  safety: {
    label: "安全・通報方針",
    href: "/safety",
  },
  accountDeletion: {
    label: "退会・データ削除",
    href: "/account-deletion",
  },
} as const;

export const LEGAL_DOCUMENT_LINKS = [
  LEGAL_DOCUMENTS.terms,
  LEGAL_DOCUMENTS.privacy,
  LEGAL_DOCUMENTS.operator,
  LEGAL_DOCUMENTS.contact,
  LEGAL_DOCUMENTS.safety,
  LEGAL_DOCUMENTS.accountDeletion,
] as const;

/** 現行コードで確認できる運営・問い合わせ導線。公開前に運営／法務が確定する。 */
export const SERVICE_OPERATOR = {
  name: "Volunty運営事務局",
  repositoryOwner: "seikatu-gakari",
  contactLabel: "GitHubの問い合わせ窓口",
  contactHref: "https://github.com/seikatu-gakari/volunty/issues/new",
} as const;

export const SIGNUP_CONSENT_COOKIE = "volunty_signup_consent";
export const SIGNUP_CONSENT_MAX_AGE_SECONDS = 10 * 60;
