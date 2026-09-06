"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

function revalidateBookmarkPaths(opportunityId: string) {
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/mypage/bookmarks");
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
    if (existing) {
      revalidateBookmarkPaths(opportunityId);
      return { success: true };
    }

    await prisma.engagementEvent.create({
      data: {
        userId: auth.userId,
        opportunityId,
        event: "favorite",
        source: "search",
      },
      select: { id: true },
    });

    revalidateBookmarkPaths(opportunityId);

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

    revalidateBookmarkPaths(opportunityId);

    return { success: true };
  } catch (err) {
    console.error("[removeBookmark] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}
