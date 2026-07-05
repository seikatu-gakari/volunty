"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  OrganizationDetailResult,
  OrganizationDetail,
  OrganizationOpportunity,
} from "./types";

/**
 * 団体詳細データを取得する
 *
 * - organizations テーブルから団体情報を取得
 * - opportunities（status = 'published'）を合わせて取得
 */
export async function fetchOrganizationDetail(
  organizationId: string
): Promise<OrganizationDetailResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        organization: null,
        opportunities: [],
        isParticipant: false,
      };
    }

    // 団体データを取得
    const { data: orgData, error: orgError } = await supabase
      .from("m_organization_profile")
      .select("id, organization_name, description")
      .eq("id", organizationId)
      .single();

    if (orgError || !orgData) {
      return {
        organization: null,
        opportunities: [],
        isParticipant: false,
      };
    }

    const organization: OrganizationDetail = {
      id: orgData.id as string,
      name: (orgData as unknown as { organization_name: string }).organization_name,
      description: (orgData.description as string) ?? null,
    };

    // 参加者判定
    const { data: participant } = await supabase
      .from("m_participant_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const isParticipant = Boolean(participant);

    // 公開中の募集案件を取得
    const { data: oppData } = await supabase
      .from("m_opportunity")
      .select("id, title, description")
      .eq("organization_id", organizationId)
      .eq("status", "published");

    const opportunities: OrganizationOpportunity[] = (oppData ?? []).map(
      (opp) => ({
        id: opp.id as string,
        title: opp.title as string,
        description: (opp.description as string) ?? null,
      })
    );

    return {
      organization,
      opportunities,
      isParticipant,
    };
  } catch (err) {
    console.error("[fetchOrganizationDetail] 予期しないエラー:", err);
    return {
      organization: null,
      opportunities: [],
      isParticipant: false,
    };
  }
}
