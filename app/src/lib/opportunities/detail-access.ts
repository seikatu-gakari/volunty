import type { ViewerContext } from "@/lib/auth/viewer-context";

export type OpportunityActionMode = "login-required" | "participant" | "read-only";

/** 公開詳細で表示する状態変更操作を閲覧者ロールから決定する。 */
export function getOpportunityActionMode(
  viewer: ViewerContext,
  isParticipant: boolean,
): OpportunityActionMode {
  if (viewer.status === "guest") return "login-required";
  if (viewer.status === "authenticated" && isParticipant) return "participant";
  return "read-only";
}
