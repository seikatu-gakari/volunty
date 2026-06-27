#!/usr/bin/env tsx

import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PERSONAS,
  type Persona,
  type PersonaKey,
} from "@/lib/test-auth/personas";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const BIG5_SCORES = {
  extraversion: 65,
  agreeableness: 82,
  conscientiousness: 60,
  neuroticism: 35,
  openness: 55,
};

const ORGANIZATION_FLOW_OPPORTUNITY_TITLE = "E2E 団体フロー案件";
const PARTICIPANT_APPLICATION_OPPORTUNITY_TITLE = "E2E 応募対象案件";

function buildUserMetadata(persona: Persona): Record<string, string | boolean> {
  const metadata: Record<string, string | boolean> = {
    full_name: `E2E ${persona.key}`,
  };

  if (persona.key !== "participant-fresh") {
    metadata.role = persona.role;
    metadata.onboarding_completed = true;
  }

  return metadata;
}

function requirePersonaId(
  idByEmail: ReadonlyMap<string, string>,
  personaKey: PersonaKey
): string {
  const id = idByEmail.get(PERSONAS[personaKey].email);
  if (!id) {
    throw new Error(`[seed] persona ID が見つかりません: ${personaKey}`);
  }
  return id;
}

async function upsertPublishedOpportunity(
  organizationId: string,
  title: string,
  description: string,
  currentApplicants: number
): Promise<string> {
  const data = {
    organizationId,
    title,
    description,
    requirementTraits: BIG5_SCORES,
    location: "東京都",
    capacity: 20,
    category: "地域活性化",
    participationMode: "offline" as const,
    currentApplicants,
    status: "published" as const,
    publishedAt: new Date(),
  };
  const existing = await prisma.opportunity.findFirst({
    where: { organizationId, title },
    select: { id: true },
  });

  if (existing) {
    await prisma.opportunity.update({
      where: { id: existing.id },
      data,
    });
    return existing.id;
  }

  const created = await prisma.opportunity.create({ data });
  return created.id;
}

export async function seedE2eUsers(): Promise<void> {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password) {
    throw new Error("E2E_TEST_USER_PASSWORD が未設定です");
  }

  const supabase = createAdminClient();
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    throw new Error(`[seed] ユーザー一覧取得失敗: ${listError.message}`);
  }

  const usersByEmail = new Map(
    listData.users.flatMap((user) =>
      user.email ? [[user.email, user] as const] : []
    )
  );
  const idByEmail = new Map<string, string>();

  for (const persona of Object.values(PERSONAS)) {
    const existingUser = usersByEmail.get(persona.email);
    const userMetadata = buildUserMetadata(persona);
    let userId: string;

    if (existingUser) {
      const { error } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password, user_metadata: userMetadata }
      );
      if (error) {
        throw new Error(
          `[seed] 更新失敗 ${persona.email}: ${error.message}`
        );
      }

      userId = existingUser.id;
      console.log(`[seed] 更新: ${persona.email} (${persona.key})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: persona.email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (error || !data.user) {
        throw new Error(
          `[seed] 作成失敗 ${persona.email}: ${error?.message ?? "user が返されませんでした"}`
        );
      }

      userId = data.user.id;
      usersByEmail.set(persona.email, data.user);
      console.log(`[seed] 作成: ${persona.email} (${persona.key})`);
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: { role: persona.role, email: persona.email },
      create: {
        id: userId,
        email: persona.email,
        name: `E2E ${persona.key}`,
        role: persona.role,
      },
    });
    idByEmail.set(persona.email, userId);
  }

  const onboardedId = requirePersonaId(idByEmail, "participant-onboarded");
  const suspendableId = requirePersonaId(
    idByEmail,
    "participant-suspendable"
  );
  const orgApprovedId = requirePersonaId(idByEmail, "organization-approved");
  const orgPendingId = requirePersonaId(idByEmail, "organization-pending");

  await prisma.participantProfile.upsert({
    where: { userId: onboardedId },
    update: {
      name: "E2E 参加者(診断済)",
      birthday: new Date("1995-04-01"),
      region: "東京都",
      publicProfile: true,
      diagnosisType: "supporter-care",
      diagnosisScores: BIG5_SCORES,
      diagnosisMode: "brief",
    },
    create: {
      userId: onboardedId,
      name: "E2E 参加者(診断済)",
      birthday: new Date("1995-04-01"),
      region: "東京都",
      publicProfile: true,
      diagnosisType: "supporter-care",
      diagnosisScores: BIG5_SCORES,
      diagnosisMode: "brief",
    },
  });

  const personalityType = await prisma.personalityType.findUnique({
    where: { typeId: "supporter-care" },
    select: { id: true },
  });
  let diagnosisResult = await prisma.diagnosisResult.findFirst({
    where: { userId: onboardedId },
    orderBy: { concludedAt: "desc" },
    select: { id: true },
  });
  if (!diagnosisResult) {
    diagnosisResult = await prisma.diagnosisResult.create({
      data: {
        userId: onboardedId,
        personalityTypeId: personalityType?.id ?? null,
        big5Scores: BIG5_SCORES,
        diagnosisMode: "brief",
      },
      select: { id: true },
    });
  }

  const approvedOrganization = await prisma.organizationProfile.upsert({
    where: { userId: orgApprovedId },
    update: {
      organizationName: "E2E承認済み団体",
      reviewStatus: "approved",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["東京都"],
      activityCategories: ["地域活性化"],
    },
    create: {
      userId: orgApprovedId,
      organizationName: "E2E承認済み団体",
      reviewStatus: "approved",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["東京都"],
      activityCategories: ["地域活性化"],
    },
  });

  const organizationFlowOpportunityId = await upsertPublishedOpportunity(
    approvedOrganization.id,
    ORGANIZATION_FLOW_OPPORTUNITY_TITLE,
    "団体の応募者承認フローを確認するE2E固定案件です。",
    1
  );
  const participantApplicationOpportunityId = await upsertPublishedOpportunity(
    approvedOrganization.id,
    PARTICIPANT_APPLICATION_OPPORTUNITY_TITLE,
    "参加者の新規応募フローを確認するE2E固定案件です。",
    0
  );

  await prisma.matchingCandidate.deleteMany({
    where: {
      participantId: onboardedId,
      opportunityId: participantApplicationOpportunityId,
    },
  });
  await prisma.matchingCandidate.upsert({
    where: {
      participantId_opportunityId: {
        participantId: onboardedId,
        opportunityId: organizationFlowOpportunityId,
      },
    },
    update: {
      diagnosisResultId: diagnosisResult.id,
      matchScore: 80,
      status: "applied",
      appliedAt: new Date(),
      statusChangedAt: new Date(),
      message: "E2E 応募メッセージ",
    },
    create: {
      participantId: onboardedId,
      opportunityId: organizationFlowOpportunityId,
      diagnosisResultId: diagnosisResult.id,
      matchScore: 80,
      status: "applied",
      appliedAt: new Date(),
      message: "E2E 応募メッセージ",
    },
  });

  await prisma.organizationProfile.upsert({
    where: { userId: orgPendingId },
    update: {
      organizationName: "E2E審査待ち団体",
      reviewStatus: "pending",
      verified: false,
      reviewComment: null,
      reviewedAt: null,
      reviewedBy: null,
      profileCompleteness: 80,
      activityAreas: ["神奈川県"],
      activityCategories: ["子ども支援"],
    },
    create: {
      userId: orgPendingId,
      organizationName: "E2E審査待ち団体",
      reviewStatus: "pending",
      verified: false,
      profileCompleteness: 80,
      activityAreas: ["神奈川県"],
      activityCategories: ["子ども支援"],
    },
  });

  await prisma.user.update({
    where: { id: suspendableId },
    data: {
      isActive: true,
      suspendedAt: null,
      suspendReason: null,
      suspendedBy: null,
    },
  });

  console.log("[seed] E2E ユーザーとスモーク前提データの seed 完了");
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(
    entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  void seedE2eUsers()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
