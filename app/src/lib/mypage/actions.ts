"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  MyPageData,
  ApplicationWithDetails,
  ParticipantProfile,
} from "./types";

/**
 * 参加者マイページ用データ取得
 *
 * - participants テーブルからプロフィール情報を取得
 * - applications + opportunities + organizations を JOIN して応募一覧を取得
 * - status = 'approved' の場合のみ organizations.line_id を含める
 */
export async function fetchMyPageData(): Promise<MyPageData> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { profile: null, applications: [] };
  }

  // 参加者プロフィール取得
  let profile: ParticipantProfile | null = null;
  try {
    const profileData = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true, region: true, diagnosisType: true, diagnosisScores: true },
    });

    if (profileData) {
      profile = {
        id: profileData.id,
        name: profileData.name,
        region: profileData.region,
        diagnosis_type: profileData.diagnosisType,
        diagnosis_scores: profileData.diagnosisScores as Record<string, number> | null,
      };
    }
  } catch {
    // Prisma 接続エラー時はスキップ
  }

  // 応募一覧取得（opportunities + organizations JOIN）
  let applications: ApplicationWithDetails[] = [];
  try {
    const { data: appData } = await supabase
      .from("applications")
      .select(
        `
        id,
        status,
        message,
        created_at,
        opportunities (
          id,
          title,
          organization_id,
          organizations (
            name,
            line_id
          )
        )
      `
      )
      .eq("participant_id", user.id)
      .order("created_at", { ascending: false });

    if (appData) {
      applications = appData.map((app) => {
        // Supabase の JOIN 結果を型変換
        const opp = app.opportunities as unknown as {
          id: string;
          title: string;
          organizations: { name: string; line_id: string | null } | null;
        } | null;

        return {
          id: app.id as string,
          status: app.status as ApplicationWithDetails["status"],
          message: (app.message as string) ?? null,
          created_at: app.created_at as string,
          opportunity: {
            id: opp?.id ?? "",
            title: opp?.title ?? "",
            organization_name: opp?.organizations?.name ?? "",
            // approved の場合のみ LINE ID を返す
            organization_line_id:
              app.status === "approved"
                ? (opp?.organizations?.line_id ?? null)
                : null,
          },
        };
      });
    }
  } catch {
    // テーブル未作成・接続エラー時はスキップ
  }

  return { profile, applications };
}
