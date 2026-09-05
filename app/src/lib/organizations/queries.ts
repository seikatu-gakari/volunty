import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  OrganizationDetail,
  OrganizationDetailResult,
  OrganizationOpportunity,
} from "./types";

/** 検証済みの参加者 userId で団体詳細を取得する。 */
export async function fetchOrganizationDetailQuery(
  userId: string,
  organizationId: string
): Promise<OrganizationDetailResult> {
  try {
    const supabase = await createClient();

    const { data: orgData, error: orgError } = await supabase
      .from("m_organization_profile")
      .select("id, organization_name, description")
      .eq("id", organizationId)
      .single();

    if (orgError || !orgData) {
      return { organization: null, opportunities: [], isParticipant: false };
    }

    const organization: OrganizationDetail = {
      id: orgData.id as string,
      name: (orgData as unknown as { organization_name: string })
        .organization_name,
      description: (orgData.description as string) ?? null,
    };

    const { data: participant } = await supabase
      .from("m_participant_profile")
      .select("id")
      .eq("user_id", userId)
      .single();

    const { data: opportunityData } = await supabase
      .from("m_opportunity")
      .select("id, title, description")
      .eq("organization_id", organizationId)
      .eq("status", "published");

    const opportunities: OrganizationOpportunity[] = (opportunityData ?? []).map(
      (opportunity) => ({
        id: opportunity.id as string,
        title: opportunity.title as string,
        description: (opportunity.description as string) ?? null,
      })
    );

    return {
      organization,
      opportunities,
      isParticipant: Boolean(participant),
    };
  } catch (error) {
    console.error("[fetchOrganizationDetailQuery] 予期しないエラー:", error);
    return { organization: null, opportunities: [], isParticipant: false };
  }
}
