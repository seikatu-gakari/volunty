import "server-only";

import { prisma } from "@/lib/prisma";
import type { BookmarkItem, BookmarksResult } from "./actions";

/** 検証済み参加者のお気に入り案件 ID を取得する。 */
export async function fetchBookmarkedOpportunityIds(
  userId: string,
  opportunityIds?: string[],
): Promise<string[]> {
  try {
    const favorites = await prisma.engagementEvent.findMany({
      where: {
        userId,
        event: "favorite",
        ...(opportunityIds ? { opportunityId: { in: opportunityIds } } : {}),
      },
      select: { opportunityId: true },
    });
    return favorites.map(({ opportunityId }) => opportunityId);
  } catch (err) {
    console.error("[fetchBookmarkedOpportunityIds] 予期しないエラー:", err);
    return [];
  }
}

/** 検証済み参加者のお気に入り一覧を取得する。 */
export async function fetchMyBookmarks(userId: string): Promise<BookmarksResult> {
  try {
    const favorites = await prisma.engagementEvent.findMany({
      where: {
        userId,
        event: "favorite",
        opportunity: { status: "published", publishedAt: { lte: new Date() } },
      },
      select: {
        opportunity: {
          select: {
            id: true,
            title: true,
            description: true,
            organization: { select: { organizationName: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    const bookmarks: BookmarkItem[] = favorites.map(({ opportunity }) => ({
      id: opportunity.id,
      title: opportunity.title,
      description: opportunity.description,
      organizationName: opportunity.organization.organizationName,
    }));
    return { bookmarks };
  } catch (err) {
    console.error("[fetchMyBookmarks] 予期しないエラー:", err);
    return { bookmarks: [], error: "予期しないエラーが発生しました" };
  }
}
