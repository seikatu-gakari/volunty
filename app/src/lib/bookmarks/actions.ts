"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export interface BookmarkMutationResult {
  success: boolean;
  error?: string;
}

export interface BookmarkItem {
  id: string;
  title: string;
  description: string | null;
  organizationName: string;
}

export interface BookmarksResult {
  bookmarks: BookmarkItem[];
  error?: string;
}

export async function fetchBookmarkedOpportunityIds(
  opportunityIds?: string[]
): Promise<string[]> {
  try {
    const auth = await getParticipantUserId();
    if ("error" in auth) return [];

    const favorites = await prisma.engagementEvent.findMany({
      where: {
        userId: auth.userId,
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

async function getParticipantUserId(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "ログインが必要です" };
  }

  const participant = await prisma.participantProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!participant) {
    return { error: "参加者登録が必要です" };
  }

  return { userId: user.id };
}

export async function addBookmark(
  opportunityId: string
): Promise<BookmarkMutationResult> {
  try {
    const auth = await getParticipantUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        status: "published",
        publishedAt: { lte: new Date() },
      },
      select: { id: true },
    });
    if (!opportunity) {
      return { success: false, error: "公開中の案件が見つかりません" };
    }

    const existing = await prisma.engagementEvent.findFirst({
      where: {
        userId: auth.userId,
        opportunityId,
        event: "favorite",
      },
      select: { id: true },
    });
    if (existing) return { success: true };

    await prisma.engagementEvent.create({
      data: {
        userId: auth.userId,
        opportunityId,
        event: "favorite",
        source: "search",
      },
      select: { id: true },
    });

    return { success: true };
  } catch (err) {
    console.error("[addBookmark] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function removeBookmark(
  opportunityId: string
): Promise<BookmarkMutationResult> {
  try {
    const auth = await getParticipantUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    await prisma.engagementEvent.deleteMany({
      where: {
        userId: auth.userId,
        opportunityId,
        event: "favorite",
      },
    });

    return { success: true };
  } catch (err) {
    console.error("[removeBookmark] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function fetchMyBookmarks(): Promise<BookmarksResult> {
  try {
    const auth = await getParticipantUserId();
    if ("error" in auth) return { bookmarks: [], error: auth.error };

    const favorites = await prisma.engagementEvent.findMany({
      where: {
        userId: auth.userId,
        event: "favorite",
        opportunity: {
          status: "published",
          publishedAt: { lte: new Date() },
        },
      },
      select: {
        opportunity: {
          select: {
            id: true,
            title: true,
            description: true,
            organization: {
              select: { organizationName: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return {
      bookmarks: favorites.map(({ opportunity }) => ({
        id: opportunity.id,
        title: opportunity.title,
        description: opportunity.description,
        organizationName: opportunity.organization.organizationName,
      })),
    };
  } catch (err) {
    console.error("[fetchMyBookmarks] 予期しないエラー:", err);
    return { bookmarks: [], error: "予期しないエラーが発生しました" };
  }
}
