"use server";

import { createClient } from "@/lib/supabase/server";
import type { DashboardData, DashboardOpportunity } from "./types";

/**
 * 団体ダッシュボード用：自団体の募集案件一覧を取得
 *
 * - opportunities テーブルから organization_id = 現在のユーザーID でフィルタ
 * - 各案件の応募者数（applications の COUNT）を含める
 * - 作成日の降順でソート
 */
export async function fetchMyOpportunities(): Promise<DashboardData> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { opportunities: [] };
  }

  let opportunities: DashboardOpportunity[] = [];
  try {
    const { data: oppData } = await supabase
      .from("opportunities")
      .select(
        `
        id,
        title,
        status,
        created_at,
        applications (
          id
        )
      `
      )
      .eq("organization_id", user.id)
      .order("created_at", { ascending: false });

    if (oppData) {
      opportunities = oppData.map((opp) => {
        // Supabase の JOIN 結果を型変換
        const apps = opp.applications as unknown as { id: string }[] | null;

        return {
          id: opp.id as string,
          title: opp.title as string,
          status: opp.status as DashboardOpportunity["status"],
          created_at: opp.created_at as string,
          application_count: Array.isArray(apps) ? apps.length : 0,
        };
      });
    }
  } catch {
    // テーブル未作成・接続エラー時はスキップ
  }

  return { opportunities };
}
