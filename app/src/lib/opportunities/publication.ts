import type { OpportunityStatus } from "./types";

/** 公開日時として扱える値。Supabase は ISO 文字列、純粋関数の呼び出し元は Date を渡せる。 */
export type PublicationDate = Date | string | null;

/** 案件の公開状態を判定するために必要な状態。 */
export interface OpportunityPublicationState {
  status: OpportunityStatus;
  publishedAt: PublicationDate;
}

/** Server Action から指定できる公開操作。 */
export type PublicationOperation =
  | { kind: "status"; status: OpportunityStatus }
  | { kind: "publishMode"; mode: "draft" | "published" }
  | { kind: "publishMode"; mode: "scheduled"; publishedAt: Date };

function publicationTimestamp(value: PublicationDate): number | null {
  if (value === null) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * 現在状態と明示操作から、保存すべき公開状態を計算する。
 * now は呼び出し元が保存処理ごとに一度だけ取得した基準時刻を渡す。
 */
export function resolvePublicationState(
  current: OpportunityPublicationState,
  operation: PublicationOperation | null,
  now: Date,
): OpportunityPublicationState {
  if (!operation) return current;

  if (operation.kind === "publishMode") {
    if (operation.mode === "draft") {
      return { status: "draft", publishedAt: null };
    }
    if (operation.mode === "scheduled") {
      return { status: "published", publishedAt: operation.publishedAt };
    }
    return { status: "published", publishedAt: now };
  }

  if (operation.status === "draft") {
    return { status: "draft", publishedAt: null };
  }
  if (operation.status === "closed") {
    return { status: "closed", publishedAt: current.publishedAt };
  }

  const keepsCurrentPublication =
    current.status === "published" &&
    publicationTimestamp(current.publishedAt) !== null;
  return {
    status: "published",
    publishedAt: keepsCurrentPublication ? current.publishedAt : now,
  };
}

/** 指定した基準時刻の時点で、参加者向けに公開できる状態か判定する。 */
export function isOpportunityPublic(
  state: OpportunityPublicationState,
  now: Date,
): boolean {
  if (state.status !== "published") return false;

  const publishedAt = publicationTimestamp(state.publishedAt);
  const currentTime = now.getTime();
  return publishedAt !== null && Number.isFinite(currentTime) && publishedAt <= currentTime;
}
