"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type {
  DashboardData,
  DashboardOpportunity,
  CreateOpportunityResult,
} from "./types";

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

/** BIG5 特性キーの一覧 */
const BIG5_TRAIT_KEYS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
] as const;

/**
 * 募集案件を新規作成する
 *
 * - opportunities テーブルに INSERT
 * - organization_id = 現在のユーザーID
 * - status = 'open'（デフォルト）
 * - required_traits = JSONB（BIG5スコア条件）
 * - 成功後、/dashboard へリダイレクト
 */
export async function createOpportunity(
  formData: FormData
): Promise<CreateOpportunityResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // フォームデータの取得
  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const rawDescription = formData.get("description");
  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";

  // バリデーション
  if (!title) {
    return { success: false, error: "タイトルは必須です" };
  }
  if (!description) {
    return { success: false, error: "説明は必須です" };
  }

  // required_traits の構築（BIG5各特性のスコア）
  const requiredTraits: Record<string, number> = {};
  for (const trait of BIG5_TRAIT_KEYS) {
    const value = formData.get(`trait_${trait}`);
    if (value !== null && value !== "") {
      const numValue = Number(value);
      if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        requiredTraits[trait] = numValue;
      }
    }
  }

  try {
    const { error: insertError } = await supabase
      .from("opportunities")
      .insert({
        organization_id: user.id,
        title,
        description,
        required_traits:
          Object.keys(requiredTraits).length > 0 ? requiredTraits : null,
        status: "open",
      });

    if (insertError) {
      return { success: false, error: "案件の作成に失敗しました" };
    }
  } catch {
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  redirect("/dashboard");
}
