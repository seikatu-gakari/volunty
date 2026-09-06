import "server-only";

import { prisma } from "@/lib/prisma";
import { findActivityStyleTag, toActivityStyleTagIds } from "@/lib/recommendations/activity-style-tags";
import type { OpportunityDetail } from "./types";

/** 公開募集詳細。団体の個人連絡先や応募者レコードは含めない。 */
export async function fetchPublicOpportunityDetail(
  opportunityId: string,
  now = new Date(),
): Promise<OpportunityDetail | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(opportunityId)) {
    return null;
  }
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      status: "published",
      publishedAt: { lte: now },
    },
    select: {
      id: true,
      title: true,
      description: true,
      activityStyleTags: true,
      requiredQualifications: true,
      minAge: true,
      maxAge: true,
      location: true,
      startDate: true,
      endDate: true,
      schedule: true,
      capacity: true,
      currentApplicants: true,
      category: true,
      participationMode: true,
      cost: true,
      belongings: true,
      applicationDeadline: true,
      cancellationPolicy: true,
      insuranceDetails: true,
      contactMethod: true,
      createdAt: true,
      organization: {
        select: {
          id: true,
          organizationName: true,
          description: true,
          websiteUrl: true,
          verified: true,
        },
      },
    },
  });

  if (!opportunity) return null;

  return {
    id: opportunity.id,
    title: opportunity.title,
    description: opportunity.description,
    activity_style_labels: toActivityStyleTagIds(opportunity.activityStyleTags)
      .map((tagId) => findActivityStyleTag(tagId)?.label)
      .filter((label): label is string => Boolean(label)),
    required_qualifications: Array.isArray(opportunity.requiredQualifications)
      ? opportunity.requiredQualifications.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    min_age: opportunity.minAge,
    max_age: opportunity.maxAge,
    status: "published",
    organization: {
      id: opportunity.organization.id,
      name: opportunity.organization.organizationName,
      description: opportunity.organization.description,
      website_url: opportunity.organization.websiteUrl,
      verified: opportunity.organization.verified,
    },
    created_at: opportunity.createdAt.toISOString(),
    location: opportunity.location,
    start_date: opportunity.startDate?.toISOString().slice(0, 10) ?? null,
    end_date: opportunity.endDate?.toISOString().slice(0, 10) ?? null,
    schedule: opportunity.schedule,
    capacity: opportunity.capacity,
    current_applicants: opportunity.currentApplicants,
    category: opportunity.category,
    participation_mode: opportunity.participationMode,
    cost: opportunity.cost,
    belongings: opportunity.belongings,
    application_deadline:
      opportunity.applicationDeadline?.toISOString().slice(0, 10) ?? null,
    cancellation_policy: opportunity.cancellationPolicy,
    insurance_details: opportunity.insuranceDetails,
    contact_method: opportunity.contactMethod,
  };
}
