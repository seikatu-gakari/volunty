#!/usr/bin/env tsx

import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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
const FILTER_OPPORTUNITY_TITLE = "E2E オンライン環境保全案件";
const PENDING_APPLICATION_TITLE = "E2E 審査中応募案件";
const ACCEPTED_APPLICATION_TITLE = "E2E 成立済み応募案件";
const CERTIFICATE_REQUEST_TITLE = "E2E 証明書申請対象案件";
const CERTIFICATE_PENDING_TITLE = "E2E 申請中証明書案件";
const CERTIFICATE_ISSUED_TITLE = "E2E 発行済み証明書案件";
const CERTIFICATE_REJECTED_TITLE = "E2E 却下済み証明書案件";
const APPROACH_ACCEPT_TITLE = "E2E 承諾対象アプローチ案件";
const APPROACH_DECLINE_TITLE = "E2E 辞退対象アプローチ案件";
const APPROACH_EXPIRED_TITLE = "E2E 期限切れアプローチ案件";

interface OpportunitySeedOptions {
  location?: string;
  category?: string;
  participationMode?: "online" | "offline" | "hybrid";
  currentApplicants?: number;
}

function buildUserMetadata(
  persona: Persona
): Record<string, string | boolean | null> {
  const metadata: Record<string, string | boolean | null> = {
    full_name: `E2E ${persona.key}`,
  };

  if (persona.key === "participant-fresh") {
    // updateUserById は metadata をマージするため、前回E2Eの値を明示的に消す。
    metadata.role = null;
    metadata.onboarding_completed = false;
  } else {
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
  options: OpportunitySeedOptions = {}
): Promise<string> {
  const data = {
    organizationId,
    title,
    description,
    requirementTraits: BIG5_SCORES,
    location: options.location ?? "東京都",
    capacity: 20,
    category: options.category ?? "地域活性化",
    participationMode: options.participationMode ?? ("offline" as const),
    currentApplicants: options.currentApplicants ?? 0,
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

async function upsertMatchingCandidate({
  participantId,
  opportunityId,
  status,
  message,
}: {
  participantId: string;
  opportunityId: string;
  status: "applied" | "accepted" | "completed";
  message: string;
}): Promise<string> {
  const now = new Date();
  const candidate = await prisma.matchingCandidate.upsert({
    where: {
      participantId_opportunityId: { participantId, opportunityId },
    },
    update: {
      matchScore: 80,
      status,
      appliedAt: now,
      statusChangedAt: now,
      message,
    },
    create: {
      participantId,
      opportunityId,
      matchScore: 80,
      status,
      appliedAt: now,
      statusChangedAt: now,
      message,
    },
    select: { id: true },
  });
  return candidate.id;
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

  const freshId = requirePersonaId(idByEmail, "participant-fresh");
  const onboardedId = requirePersonaId(idByEmail, "participant-onboarded");
  const diagnosisId = requirePersonaId(idByEmail, "participant-diagnosis");
  const lifecycleId = requirePersonaId(idByEmail, "participant-lifecycle");
  const deleteId = requirePersonaId(idByEmail, "participant-delete");
  const suspendableId = requirePersonaId(
    idByEmail,
    "participant-suspendable"
  );
  const suspendedId = requirePersonaId(idByEmail, "participant-suspended");
  const orgApprovedId = requirePersonaId(idByEmail, "organization-approved");
  const orgPendingId = requirePersonaId(idByEmail, "organization-pending");
  const orgRejectedId = requirePersonaId(idByEmail, "organization-rejected");
  const orgSecondaryId = requirePersonaId(idByEmail, "organization-secondary");

  // オンボーディングE2Eが作成した状態をseedごとに初期化する。
  await prisma.diagnosisResult.deleteMany({ where: { userId: freshId } });
  await prisma.participantProfile.deleteMany({ where: { userId: freshId } });

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

  await prisma.participantProfile.upsert({
    where: { userId: diagnosisId },
    update: {
      name: "E2E 診断専用参加者",
      birthday: new Date("1996-05-02"),
      region: "東京都",
      publicProfile: true,
      diagnosisType: null,
      diagnosisScores: Prisma.JsonNull,
      diagnosisMode: null,
    },
    create: {
      userId: diagnosisId,
      name: "E2E 診断専用参加者",
      birthday: new Date("1996-05-02"),
      region: "東京都",
      publicProfile: true,
    },
  });
  await prisma.diagnosisResult.deleteMany({ where: { userId: diagnosisId } });

  const lifecycleProfile = await prisma.participantProfile.upsert({
    where: { userId: lifecycleId },
    update: {
      name: "E2E ライフサイクル参加者",
      birthday: new Date("1994-06-03"),
      region: "東京都",
      publicProfile: true,
      diagnosisType: "supporter-care",
      diagnosisScores: BIG5_SCORES,
      diagnosisMode: "brief",
    },
    create: {
      userId: lifecycleId,
      name: "E2E ライフサイクル参加者",
      birthday: new Date("1994-06-03"),
      region: "東京都",
      publicProfile: true,
      diagnosisType: "supporter-care",
      diagnosisScores: BIG5_SCORES,
      diagnosisMode: "brief",
    },
  });

  await prisma.participantProfile.upsert({
    where: { userId: deleteId },
    update: {
      name: "E2E 削除専用参加者",
      birthday: new Date("1993-07-04"),
      region: "東京都",
      publicProfile: false,
    },
    create: {
      userId: deleteId,
      name: "E2E 削除専用参加者",
      birthday: new Date("1993-07-04"),
      region: "東京都",
      publicProfile: false,
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
      contactEmail: "e2e-org-approved@example.com",
      contactLineId: "@volunty-e2e",
      contactLineUrl: "https://line.me/R/ti/p/@volunty-e2e",
    },
    create: {
      userId: orgApprovedId,
      organizationName: "E2E承認済み団体",
      reviewStatus: "approved",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["東京都"],
      activityCategories: ["地域活性化"],
      contactEmail: "e2e-org-approved@example.com",
      contactLineId: "@volunty-e2e",
      contactLineUrl: "https://line.me/R/ti/p/@volunty-e2e",
    },
  });

  const organizationFlowOpportunityId = await upsertPublishedOpportunity(
    approvedOrganization.id,
    ORGANIZATION_FLOW_OPPORTUNITY_TITLE,
    "団体の応募者承認フローを確認するE2E固定案件です。",
    { currentApplicants: 1 }
  );
  const participantApplicationOpportunityId = await upsertPublishedOpportunity(
    approvedOrganization.id,
    PARTICIPANT_APPLICATION_OPPORTUNITY_TITLE,
    "参加者の新規応募フローを確認するE2E固定案件です。"
  );
  await upsertPublishedOpportunity(
    approvedOrganization.id,
    FILTER_OPPORTUNITY_TITLE,
    "おすすめ案件のフィルターを確認するE2E固定案件です。",
    {
      location: "新宿区",
      category: "環境保全",
      participationMode: "online",
    }
  );

  const lifecycleOpportunityEntries = await Promise.all(
    [
      [PENDING_APPLICATION_TITLE, "審査中応募の表示を確認します。"],
      [ACCEPTED_APPLICATION_TITLE, "成立済み応募のLINE表示を確認します。"],
      [CERTIFICATE_REQUEST_TITLE, "証明書申請フローを確認します。"],
      [CERTIFICATE_PENDING_TITLE, "申請中証明書の表示を確認します。"],
      [CERTIFICATE_ISSUED_TITLE, "発行済み証明書のPDFを確認します。"],
      [CERTIFICATE_REJECTED_TITLE, "却下済み証明書を確認します。"],
      [APPROACH_ACCEPT_TITLE, "承諾するアプローチを確認します。"],
      [APPROACH_DECLINE_TITLE, "辞退するアプローチを確認します。"],
      [APPROACH_EXPIRED_TITLE, "期限切れアプローチを確認します。"],
    ].map(async ([title, description]) => [
      title,
      await upsertPublishedOpportunity(
        approvedOrganization.id,
        title,
        description
      ),
    ] as const)
  );
  const lifecycleOpportunityIds = new Map(lifecycleOpportunityEntries);

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

  const pendingApplicationId = await upsertMatchingCandidate({
    participantId: lifecycleId,
    opportunityId: lifecycleOpportunityIds.get(PENDING_APPLICATION_TITLE)!,
    status: "applied",
    message: "E2E 審査中応募メッセージ",
  });
  const acceptedApplicationId = await upsertMatchingCandidate({
    participantId: lifecycleId,
    opportunityId: lifecycleOpportunityIds.get(ACCEPTED_APPLICATION_TITLE)!,
    status: "accepted",
    message: "E2E 成立済み応募メッセージ",
  });
  const certificateRequestApplicationId = await upsertMatchingCandidate({
    participantId: lifecycleId,
    opportunityId: lifecycleOpportunityIds.get(CERTIFICATE_REQUEST_TITLE)!,
    status: "completed",
    message: "E2E 証明書申請対象メッセージ",
  });
  const pendingCertificateApplicationId = await upsertMatchingCandidate({
    participantId: lifecycleId,
    opportunityId: lifecycleOpportunityIds.get(CERTIFICATE_PENDING_TITLE)!,
    status: "completed",
    message: "E2E 申請中証明書メッセージ",
  });
  const issuedApplicationId = await upsertMatchingCandidate({
    participantId: lifecycleId,
    opportunityId: lifecycleOpportunityIds.get(CERTIFICATE_ISSUED_TITLE)!,
    status: "completed",
    message: "E2E 発行済み証明書メッセージ",
  });
  const rejectedApplicationId = await upsertMatchingCandidate({
    participantId: lifecycleId,
    opportunityId: lifecycleOpportunityIds.get(CERTIFICATE_REJECTED_TITLE)!,
    status: "completed",
    message: "E2E 却下済み証明書メッセージ",
  });

  const now = new Date();
  const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const [title, expiresAt] of [
    [APPROACH_ACCEPT_TITLE, future],
    [APPROACH_DECLINE_TITLE, future],
    [APPROACH_EXPIRED_TITLE, past],
  ] as const) {
    const opportunityId = lifecycleOpportunityIds.get(title)!;
    await prisma.approach.upsert({
      where: {
        organizationId_participantProfileId_opportunityId: {
          organizationId: approvedOrganization.id,
          participantProfileId: lifecycleProfile.id,
          opportunityId,
        },
      },
      update: {
        message: `${title}のE2Eアプローチ文です。`,
        matchScore: 80,
        status: "sent",
        expiresAt,
        respondedAt: null,
      },
      create: {
        organizationId: approvedOrganization.id,
        participantProfileId: lifecycleProfile.id,
        opportunityId,
        message: `${title}のE2Eアプローチ文です。`,
        matchScore: 80,
        status: "sent",
        expiresAt,
      },
    });
  }

  await prisma.certificate.deleteMany({
    where: { applicationId: certificateRequestApplicationId },
  });

  await prisma.certificate.upsert({
    where: { applicationId: pendingCertificateApplicationId },
    update: {
      status: "pending",
      certificateNumber: null,
      approvedAt: null,
      issuedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    create: {
      applicationId: pendingCertificateApplicationId,
      participantId: lifecycleId,
      organizationId: approvedOrganization.id,
      opportunityId: lifecycleOpportunityIds.get(CERTIFICATE_PENDING_TITLE)!,
      status: "pending",
    },
  });
  await prisma.certificate.upsert({
    where: { applicationId: issuedApplicationId },
    update: {
      status: "issued",
      certificateNumber: "VOL-E2E-ISSUED",
      approvedAt: now,
      issuedAt: now,
      rejectedAt: null,
      rejectionReason: null,
    },
    create: {
      applicationId: issuedApplicationId,
      participantId: lifecycleId,
      organizationId: approvedOrganization.id,
      opportunityId: lifecycleOpportunityIds.get(CERTIFICATE_ISSUED_TITLE)!,
      status: "issued",
      certificateNumber: "VOL-E2E-ISSUED",
      approvedAt: now,
      issuedAt: now,
    },
  });
  await prisma.certificate.upsert({
    where: { applicationId: rejectedApplicationId },
    update: {
      status: "rejected",
      certificateNumber: null,
      approvedAt: null,
      issuedAt: null,
      rejectedAt: now,
      rejectionReason: "E2E 却下理由",
    },
    create: {
      applicationId: rejectedApplicationId,
      participantId: lifecycleId,
      organizationId: approvedOrganization.id,
      opportunityId: lifecycleOpportunityIds.get(CERTIFICATE_REJECTED_TITLE)!,
      status: "rejected",
      rejectedAt: now,
      rejectionReason: "E2E 却下理由",
    },
  });

  void pendingApplicationId;
  void acceptedApplicationId;
  void certificateRequestApplicationId;

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

  await prisma.organizationProfile.upsert({
    where: { userId: orgRejectedId },
    update: {
      organizationName: "E2E否認済み団体",
      reviewStatus: "rejected",
      verified: false,
      reviewComment: "E2E否認理由",
      profileCompleteness: 80,
      activityAreas: ["埼玉県"],
      activityCategories: ["福祉"],
    },
    create: {
      userId: orgRejectedId,
      organizationName: "E2E否認済み団体",
      reviewStatus: "rejected",
      verified: false,
      reviewComment: "E2E否認理由",
      profileCompleteness: 80,
      activityAreas: ["埼玉県"],
      activityCategories: ["福祉"],
    },
  });

  await prisma.organizationProfile.upsert({
    where: { userId: orgSecondaryId },
    update: {
      organizationName: "E2E別所有者団体",
      reviewStatus: "approved",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["千葉県"],
      activityCategories: ["教育"],
    },
    create: {
      userId: orgSecondaryId,
      organizationName: "E2E別所有者団体",
      reviewStatus: "approved",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["千葉県"],
      activityCategories: ["教育"],
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

  await prisma.user.update({
    where: { id: suspendedId },
    data: {
      isActive: false,
      suspendedAt: new Date(),
      suspendReason: "E2E凍結ユーザー",
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
