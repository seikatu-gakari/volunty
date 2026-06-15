export type OnboardingRole = "participant" | "organization" | "admin";

/** DB と Auth metadata の role 値を安全にオンボーディング用 role へ変換する */
export function parseOnboardingRole(role: unknown): OnboardingRole | null {
  if (role === "participant" || role === "organization" || role === "admin") {
    return role;
  }

  return null;
}

/** DB の role を優先し、存在しない場合だけ Auth metadata の role を使う */
export function resolveOnboardingRole({
  dbRole,
  metadataRole,
}: {
  dbRole: unknown;
  metadataRole: unknown;
}): OnboardingRole | null {
  return parseOnboardingRole(dbRole) ?? parseOnboardingRole(metadataRole);
}

/** 参加者オンボーディング用の role 不一致エラー文言を返す */
export function getParticipantRoleError(role: OnboardingRole | null): string {
  if (role === null) {
    return "参加者ロールの選択が必要です";
  }

  return "参加者アカウントでログインしてください";
}
