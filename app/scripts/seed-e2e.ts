#!/usr/bin/env tsx

import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IPIP_BFM_50_JA,
  NORMS_VERSION,
  SCORING_ALGORITHM_VERSION,
} from "@/lib/diagnosis-scale/scale";
import { QUALITY_RULE_VERSION } from "@/lib/diagnosis-scale/quality";
import { STYLE_TYPE_VERSION } from "@/lib/diagnosis-scale/style-types";
import {
  PERSONAS,
  type Persona,
  type PersonaKey,
} from "@/lib/test-auth/personas";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

// supporter-care タイプの代表プロファイルに近い診断スコア（scaled 0-100 / raw 10-50）
const SCALED_SCORES = {
  extraversion: 70,
  agreeableness: 90,
  conscientiousness: 50,
  emotionalStability: 70,
  intellect: 50,
};
const RAW_SCORES = {
  extraversion: 38,
  agreeableness: 46,
  conscientiousness: 30,
  emotionalStability: 38,
  intellect: 30,
};
const LOW_SCALED_SCORES = {
  extraversion: 20,
  agreeableness: 25,
  conscientiousness: 30,
  emotionalStability: 25,
  intellect: 25,
};
const LOW_RAW_SCORES = {
  extraversion: 18,
  agreeableness: 20,
  conscientiousness: 24,
  emotionalStability: 20,
  intellect: 20,
};
const STYLE_TYPE_ID = "supporter-care";

const ORGANIZATION_FIXTURE_PARTICIPANT = {
  id: "00000000-0000-4000-8000-000000000167",
  profileId: "00000000-0000-4000-8000-000000000168",
  diagnosisResultId: "00000000-0000-4000-8000-000000000169",
  email: "e2e-organization-fixture-participant@example.com",
  name: "E2E 団体操作専用参加者",
} as const;

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

const lifecycleTitles = {
  recommendationHigh: "E2E 団体おすすめ高相性案件",
  recommendationLow: "E2E 団体おすすめ低相性案件",
  approachSend: "E2E 団体アプローチ送信案件",
  approachSent: "E2E 団体アプローチ未回答案件",
  approachAccepted: "E2E 団体アプローチ承諾済み案件",
  approachDeclined: "E2E 団体アプローチ辞退済み案件",
  approachExpired: "E2E 団体アプローチ期限切れ案件",
  applicantDecline: "E2E 団体応募辞退案件",
  historyAccepted: "E2E 団体履歴承認案件",
  historyDeclined: "E2E 団体履歴辞退案件",
  historyComplete: "E2E 団体活動完了案件",
  certificateApprove: "E2E 団体証明書承認案件",
  certificateReject: "E2E 団体証明書却下案件",
} as const;

interface OpportunitySeedOptions {
  location?: string;
  category?: string;
  participationMode?: "online" | "offline" | "hybrid";
  currentApplicants?: number;
  activityStyleTags?: string[];
}

interface DiagnosisSeedOptions {
  id?: string;
  rawScores?: typeof RAW_SCORES;
  scaledScores?: typeof SCALED_SCORES;
}

interface OrganizationProfileSeedOptions {
  userId: string;
  organizationName: string;
  reviewStatus: "pending" | "approved" | "rejected";
  verified: boolean;
  reviewComment: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  representativeName?: string | null;
  contactEmail?: string | null;
  activityAreas?: string[];
  activityCategories?: string[];
  description?: string | null;
  websiteUrl?: string | null;
  profileCompleteness?: number;
}

function buildUserMetadata(
  persona: Persona
): Record<string, string | boolean | null> {
  const metadata: Record<string, string | boolean | null> = {
    full_name: `E2E ${persona.key}`,
  };

  const isFresh =
    persona.key === "participant-fresh" ||
    persona.key === "organization-fresh";

  if (isFresh) {
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
    activityStyleTags: options.activityStyleTags ?? ["empathy-support"],
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

/**
 * 診断済み persona 用の診断結果を確保し、プロフィールの最新参照を設定する。
 * 生回答（t_diagnosis_response）はE2E前提データでは保存しない。
 */
async function ensureDiagnosisResult(
  userId: string,
  options: DiagnosisSeedOptions = {}
): Promise<string> {
  const rawScores = options.rawScores ?? RAW_SCORES;
  const scaledScores = options.scaledScores ?? SCALED_SCORES;
  const data = {
    userId,
    scaleCode: IPIP_BFM_50_JA.scaleCode,
    scaleVersion: IPIP_BFM_50_JA.scaleVersion,
    scoringAlgorithmVersion: SCORING_ALGORITHM_VERSION,
    normsVersion: NORMS_VERSION,
    styleTypeVersion: STYLE_TYPE_VERSION,
    qualityRuleVersion: QUALITY_RULE_VERSION,
    rawScores,
    scaledScores,
    styleTypeId: STYLE_TYPE_ID,
    qualityFlags: [],
  };

  let diagnosisResult = options.id
    ? await prisma.diagnosisResult.upsert({
        where: { id: options.id },
        update: data,
        create: { id: options.id, ...data },
        select: { id: true },
      })
    : await prisma.diagnosisResult.findFirst({
        where: { userId },
        orderBy: { answeredAt: "desc" },
        select: { id: true },
      });

  if (!diagnosisResult) {
    diagnosisResult = await prisma.diagnosisResult.create({
      data,
      select: { id: true },
    });
  } else if (!options.id) {
    await prisma.diagnosisResult.update({
      where: { id: diagnosisResult.id },
      data,
    });
  }

  await prisma.participantProfile.update({
    where: { userId },
    data: { latestDiagnosisResultId: diagnosisResult.id },
  });
  return diagnosisResult.id;
}

async function upsertMatchingCandidate({
  participantId,
  opportunityId,
  status,
  message,
}: {
  participantId: string;
  opportunityId: string;
  status: "applied" | "accepted" | "declined" | "completed";
  message: string;
}): Promise<string> {
  const now = new Date();
  const candidate = await prisma.matchingCandidate.upsert({
    where: {
      participantId_opportunityId: { participantId, opportunityId },
    },
    update: {
      status,
      appliedAt: now,
      statusChangedAt: now,
      message,
    },
    create: {
      participantId,
      opportunityId,
      status,
      appliedAt: now,
      statusChangedAt: now,
      message,
    },
    select: { id: true },
  });
  return candidate.id;
}

async function upsertOrganizationProfileFixture(
  options: OrganizationProfileSeedOptions
): Promise<void> {
  const data = {
    organizationName: options.organizationName,
    representativeName: options.representativeName ?? null,
    contactEmail: options.contactEmail ?? null,
    activityAreas: options.activityAreas ?? ["東京都"],
    activityCategories: options.activityCategories ?? ["地域活性化"],
    description: options.description ?? null,
    websiteUrl: options.websiteUrl ?? null,
    reviewStatus: options.reviewStatus,
    verified: options.verified,
    reviewComment: options.reviewComment,
    reviewedAt: options.reviewedAt,
    reviewedBy: options.reviewedBy,
    profileCompleteness: options.profileCompleteness ?? 80,
  };

  await prisma.organizationProfile.upsert({
    where: { userId: options.userId },
    update: data,
    create: {
      userId: options.userId,
      ...data,
    },
  });
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
      update: {
        role: persona.role,
        email: persona.email,
        name: `E2E ${persona.key}`,
      },
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
  const suspendableId = requirePersonaId(idByEmail, "user-suspendable");
  const suspendedId = requirePersonaId(idByEmail, "participant-suspended");
  const orgApprovedId = requirePersonaId(idByEmail, "organization-approved");
  const orgPendingId = requirePersonaId(idByEmail, "organization-pending");
  const adminReviewId = requirePersonaId(idByEmail, "admin-review");
  const orgReviewApproveId = requirePersonaId(
    idByEmail,
    "organization-review-approve"
  );
  const orgReviewRejectId = requirePersonaId(
    idByEmail,
    "organization-review-reject"
  );
  const orgFreshId = requirePersonaId(idByEmail, "organization-fresh");
  const orgReapplyId = requirePersonaId(idByEmail, "organization-reapply");
  const orgProfileReviewId = requirePersonaId(
    idByEmail,
    "organization-profile-review"
  );
  const orgLifecycleId = requirePersonaId(
    idByEmail,
    "organization-lifecycle"
  );
  const orgForeignId = requirePersonaId(idByEmail, "organization-foreign");
  const orgPendingReadonlyId = requirePersonaId(
    idByEmail,
    "organization-pending-readonly"
  );
  const orgRejectedId = requirePersonaId(idByEmail, "organization-rejected");
  const orgSecondaryId = requirePersonaId(idByEmail, "organization-secondary");

  await prisma.user.upsert({
    where: { id: ORGANIZATION_FIXTURE_PARTICIPANT.id },
    update: {
      email: ORGANIZATION_FIXTURE_PARTICIPANT.email,
      name: ORGANIZATION_FIXTURE_PARTICIPANT.name,
      role: "participant",
    },
    create: {
      id: ORGANIZATION_FIXTURE_PARTICIPANT.id,
      email: ORGANIZATION_FIXTURE_PARTICIPANT.email,
      name: ORGANIZATION_FIXTURE_PARTICIPANT.name,
      role: "participant",
    },
  });

  // オンボーディングE2Eが作成した状態をseedごとに初期化する。
  await prisma.diagnosisResult.deleteMany({ where: { userId: freshId } });
  await prisma.participantProfile.deleteMany({ where: { userId: freshId } });
  await prisma.organizationProfile.deleteMany({ where: { userId: orgFreshId } });

  await prisma.participantProfile.upsert({
    where: { userId: onboardedId },
    update: {
      name: "E2E 参加者(診断済)",
      birthday: new Date("1995-04-01"),
      region: "東京都",
      publicProfile: true,
    },
    create: {
      userId: onboardedId,
      name: "E2E 参加者(診断済)",
      birthday: new Date("1995-04-01"),
      region: "東京都",
      publicProfile: true,
    },
  });
  await ensureDiagnosisResult(onboardedId);

  await prisma.participantProfile.upsert({
    where: { userId: diagnosisId },
    update: {
      name: "E2E 診断専用参加者",
      birthday: new Date("1996-05-02"),
      region: "東京都",
      publicProfile: true,
    },
    create: {
      userId: diagnosisId,
      name: "E2E 診断専用参加者",
      birthday: new Date("1996-05-02"),
      region: "東京都",
      publicProfile: true,
    },
  });
  // 診断専用 persona は毎回未診断状態から開始する（削除により最新参照も自動で null になる）
  await prisma.diagnosisResult.deleteMany({ where: { userId: diagnosisId } });

  const lifecycleProfile = await prisma.participantProfile.upsert({
    where: { userId: lifecycleId },
    update: {
      name: "E2E ライフサイクル参加者",
      birthday: new Date("1994-06-03"),
      region: "東京都",
      publicProfile: true,
    },
    create: {
      userId: lifecycleId,
      name: "E2E ライフサイクル参加者",
      birthday: new Date("1994-06-03"),
      region: "東京都",
      publicProfile: true,
    },
  });
  await ensureDiagnosisResult(lifecycleId, {
    rawScores: LOW_RAW_SCORES,
    scaledScores: LOW_SCALED_SCORES,
  });

  const organizationFixtureParticipantProfile =
    await prisma.participantProfile.upsert({
      where: { userId: ORGANIZATION_FIXTURE_PARTICIPANT.id },
      update: {
        name: ORGANIZATION_FIXTURE_PARTICIPANT.name,
        birthday: new Date("1992-08-05"),
        region: "東京都",
        publicProfile: true,
      },
      create: {
        id: ORGANIZATION_FIXTURE_PARTICIPANT.profileId,
        userId: ORGANIZATION_FIXTURE_PARTICIPANT.id,
        name: ORGANIZATION_FIXTURE_PARTICIPANT.name,
        birthday: new Date("1992-08-05"),
        region: "東京都",
        publicProfile: true,
      },
    });
  await ensureDiagnosisResult(ORGANIZATION_FIXTURE_PARTICIPANT.id, {
    id: ORGANIZATION_FIXTURE_PARTICIPANT.diagnosisResultId,
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
  // アカウント削除E2Eで診断データの連鎖削除を検証するため、診断結果を付与する
  await ensureDiagnosisResult(deleteId);

  const organizationProfileDetails = {
    representativeName: "E2E 代表者",
    activityAreas: ["東京都"],
    description: "団体向けE2Eの固定プロフィールです。",
    activityCategories: ["地域活性化"],
    websiteUrl: "https://example.com/volunty-e2e",
    logoUrl: "https://example.com/volunty-e2e.png",
    contactLineId: "@volunty-e2e",
    contactLineUrl: "https://line.me/R/ti/p/@volunty-e2e",
    profileCompleteness: 100,
  };

  const reapplyOrganizationData = {
    ...organizationProfileDetails,
    organizationName: "E2E再申請団体",
    contactEmail: PERSONAS["organization-reapply"].email,
    reviewStatus: "rejected" as const,
    verified: false,
    reviewComment: "E2E 再申請前の否認理由",
  };
  await prisma.organizationProfile.upsert({
    where: { userId: orgReapplyId },
    update: reapplyOrganizationData,
    create: { userId: orgReapplyId, ...reapplyOrganizationData },
  });

  const profileReviewOrganizationData = {
    ...organizationProfileDetails,
    organizationName: "E2Eプロフィール再審査団体",
    contactEmail: PERSONAS["organization-profile-review"].email,
    reviewStatus: "approved" as const,
    verified: true,
    reviewComment: null,
  };
  await prisma.organizationProfile.upsert({
    where: { userId: orgProfileReviewId },
    update: profileReviewOrganizationData,
    create: { userId: orgProfileReviewId, ...profileReviewOrganizationData },
  });

  const lifecycleOrganizationData = {
    ...organizationProfileDetails,
    organizationName: "E2Eライフサイクル団体",
    contactEmail: PERSONAS["organization-lifecycle"].email,
    reviewStatus: "approved" as const,
    verified: true,
    reviewComment: null,
  };
  const lifecycleOrganization = await prisma.organizationProfile.upsert({
    where: { userId: orgLifecycleId },
    update: lifecycleOrganizationData,
    create: { userId: orgLifecycleId, ...lifecycleOrganizationData },
  });

  const foreignOrganizationData = {
    ...organizationProfileDetails,
    organizationName: "E2E別団体",
    contactEmail: PERSONAS["organization-foreign"].email,
    reviewStatus: "approved" as const,
    verified: true,
    reviewComment: null,
  };
  const foreignOrganization = await prisma.organizationProfile.upsert({
    where: { userId: orgForeignId },
    update: foreignOrganizationData,
    create: { userId: orgForeignId, ...foreignOrganizationData },
  });

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

  await prisma.opportunity.deleteMany({
    where: {
      organizationId: lifecycleOrganization.id,
      title: { startsWith: "E2E 団体案件管理" },
    },
  });

  const organizationLifecycleOpportunityEntries = await Promise.all(
    Object.values(lifecycleTitles).map(async (title) => [
      title,
      await upsertPublishedOpportunity(
        lifecycleOrganization.id,
        title,
        `${title}の状態を確認する団体向けE2E固定案件です。`
      ),
    ] as const)
  );
  const organizationLifecycleOpportunityIds = new Map(
    organizationLifecycleOpportunityEntries
  );
  await upsertPublishedOpportunity(
    foreignOrganization.id,
    "E2E 別団体所有案件",
    "所有権境界を確認する別団体のE2E固定案件です。"
  );

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
      status: "applied",
      appliedAt: new Date(),
      statusChangedAt: new Date(),
      message: "E2E 応募メッセージ",
    },
    create: {
      participantId: onboardedId,
      opportunityId: organizationFlowOpportunityId,
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
        status: "sent",
        expiresAt,
        respondedAt: null,
      },
      create: {
        organizationId: approvedOrganization.id,
        participantProfileId: lifecycleProfile.id,
        opportunityId,
        message: `${title}のE2Eアプローチ文です。`,
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

  const organizationApplicationStates = [
    [lifecycleTitles.applicantDecline, "applied"],
    [lifecycleTitles.historyAccepted, "accepted"],
    [lifecycleTitles.historyDeclined, "declined"],
    [lifecycleTitles.historyComplete, "accepted"],
    [lifecycleTitles.certificateApprove, "completed"],
    [lifecycleTitles.certificateReject, "completed"],
  ] as const;
  const organizationApplicationOpportunityIds =
    organizationApplicationStates.map(
      ([title]) => organizationLifecycleOpportunityIds.get(title)!
    );
  await prisma.matchingCandidate.deleteMany({
    where: {
      participantId: { not: ORGANIZATION_FIXTURE_PARTICIPANT.id },
      opportunityId: { in: organizationApplicationOpportunityIds },
    },
  });
  const organizationApplicationEntries = await Promise.all(
    organizationApplicationStates.map(async ([title, status]) => [
      title,
      await upsertMatchingCandidate({
        participantId: ORGANIZATION_FIXTURE_PARTICIPANT.id,
        opportunityId: organizationLifecycleOpportunityIds.get(title)!,
        status,
        message: `${title}へのE2E応募メッセージです。`,
      }),
    ] as const)
  );
  const organizationApplicationIds = new Map(organizationApplicationEntries);

  const organizationApproachOpportunityIds = [
    lifecycleTitles.approachSend,
    lifecycleTitles.approachSent,
    lifecycleTitles.approachAccepted,
    lifecycleTitles.approachDeclined,
    lifecycleTitles.approachExpired,
  ].map((title) => organizationLifecycleOpportunityIds.get(title)!);
  await prisma.approach.deleteMany({
    where: {
      organizationId: lifecycleOrganization.id,
      participantProfileId: {
        not: organizationFixtureParticipantProfile.id,
      },
      opportunityId: { in: organizationApproachOpportunityIds },
    },
  });

  await prisma.approach.deleteMany({
    where: {
      organizationId: lifecycleOrganization.id,
      participantProfileId: organizationFixtureParticipantProfile.id,
      opportunityId: organizationLifecycleOpportunityIds.get(
        lifecycleTitles.approachSend
      )!,
    },
  });

  const approachStates = [
    [lifecycleTitles.approachSent, "sent", future, null],
    [lifecycleTitles.approachAccepted, "accepted", future, now],
    [lifecycleTitles.approachDeclined, "declined", future, now],
    [lifecycleTitles.approachExpired, "sent", past, null],
  ] as const;
  for (const [title, status, expiresAt, respondedAt] of approachStates) {
    const opportunityId = organizationLifecycleOpportunityIds.get(title)!;
    await prisma.approach.upsert({
      where: {
        organizationId_participantProfileId_opportunityId: {
          organizationId: lifecycleOrganization.id,
          participantProfileId: organizationFixtureParticipantProfile.id,
          opportunityId,
        },
      },
      update: {
        message: `${title}のE2Eアプローチ文です。`,
        status,
        expiresAt,
        respondedAt,
      },
      create: {
        organizationId: lifecycleOrganization.id,
        participantProfileId: organizationFixtureParticipantProfile.id,
        opportunityId,
        message: `${title}のE2Eアプローチ文です。`,
        status,
        expiresAt,
        respondedAt,
      },
    });
  }

  for (const title of [
    lifecycleTitles.certificateApprove,
    lifecycleTitles.certificateReject,
  ] as const) {
    const applicationId = organizationApplicationIds.get(title)!;
    const opportunityId = organizationLifecycleOpportunityIds.get(title)!;
    await prisma.certificate.upsert({
      where: { applicationId },
      update: {
        status: "pending",
        certificateNumber: null,
        approvedAt: null,
        issuedAt: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      create: {
        applicationId,
        participantId: ORGANIZATION_FIXTURE_PARTICIPANT.id,
        organizationId: lifecycleOrganization.id,
        opportunityId,
        status: "pending",
        certificateNumber: null,
        approvedAt: null,
        issuedAt: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    });
  }

  void pendingApplicationId;
  void acceptedApplicationId;
  void certificateRequestApplicationId;

  await prisma.organizationProfile.upsert({
    where: { userId: orgPendingId },
    update: {
      organizationName: "E2E一覧承認団体",
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
      organizationName: "E2E一覧承認団体",
      reviewStatus: "pending",
      verified: false,
      reviewComment: null,
      reviewedAt: null,
      reviewedBy: null,
      profileCompleteness: 80,
      activityAreas: ["神奈川県"],
      activityCategories: ["子ども支援"],
    },
  });

  await upsertOrganizationProfileFixture({
    userId: orgReviewApproveId,
    organizationName: "E2E詳細承認団体",
    reviewStatus: "pending",
    verified: false,
    reviewComment: null,
    reviewedAt: null,
    reviewedBy: null,
    representativeName: "E2E承認代表",
    contactEmail: "e2e-review-approve-contact@example.com",
    activityAreas: ["東京都"],
    activityCategories: ["環境保全"],
    description: "E2E詳細承認団体の活動内容です。",
    websiteUrl: "https://example.com/e2e-review-approve",
    profileCompleteness: 90,
  });

  await upsertOrganizationProfileFixture({
    userId: orgReviewRejectId,
    organizationName: "E2E詳細否認団体",
    reviewStatus: "pending",
    verified: false,
    reviewComment: null,
    reviewedAt: null,
    reviewedBy: null,
    representativeName: "E2E否認代表",
    contactEmail: "e2e-review-reject-contact@example.com",
    activityAreas: ["大阪府"],
    activityCategories: ["子ども支援"],
    description: "E2E詳細否認団体の活動内容です。",
    websiteUrl: "https://example.com/e2e-review-reject",
    profileCompleteness: 85,
  });

  const reviewFilterUsers = [
    {
      id: "00000000-0000-4000-8000-000000000171",
      email: "e2e-org-review-filter-pending@example.com",
      name: "E2Eフィルター審査待ち団体ユーザー",
      organizationName: "E2Eフィルター審査待ち団体",
      reviewStatus: "pending" as const,
      verified: false,
      reviewComment: null,
      reviewedAt: null,
      reviewedBy: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000172",
      email: "e2e-org-review-filter-approved@example.com",
      name: "E2Eフィルター承認済み団体ユーザー",
      organizationName: "E2Eフィルター承認済み団体",
      reviewStatus: "approved" as const,
      verified: true,
      reviewComment: null,
      reviewedAt: new Date("2026-01-01T00:00:00.000Z"),
      reviewedBy: adminReviewId,
    },
    {
      id: "00000000-0000-4000-8000-000000000173",
      email: "e2e-org-review-filter-rejected@example.com",
      name: "E2Eフィルター否認済み団体ユーザー",
      organizationName: "E2Eフィルター否認済み団体",
      reviewStatus: "rejected" as const,
      verified: false,
      reviewComment: "E2Eフィルター否認理由",
      reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
      reviewedBy: adminReviewId,
    },
  ];

  for (const filterUser of reviewFilterUsers) {
    await prisma.user.upsert({
      where: { id: filterUser.id },
      update: {
        role: "organization",
        email: filterUser.email,
        name: filterUser.name,
      },
      create: {
        id: filterUser.id,
        role: "organization",
        email: filterUser.email,
        name: filterUser.name,
      },
    });

    await upsertOrganizationProfileFixture({
      userId: filterUser.id,
      organizationName: filterUser.organizationName,
      reviewStatus: filterUser.reviewStatus,
      verified: filterUser.verified,
      reviewComment: filterUser.reviewComment,
      reviewedAt: filterUser.reviewedAt,
      reviewedBy: filterUser.reviewedBy,
      profileCompleteness: 80,
    });
  }

  await prisma.organizationProfile.upsert({
    where: { userId: orgPendingReadonlyId },
    update: {
      organizationName: "E2E読取専用審査待ち団体",
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
      userId: orgPendingReadonlyId,
      organizationName: "E2E読取専用審査待ち団体",
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
