import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Persona, PersonaKey } from "@/lib/test-auth/personas";

const ORGANIZATION_FIXTURE_PARTICIPANT_ID =
  "00000000-0000-4000-8000-000000000167";
const ORGANIZATION_FIXTURE_PARTICIPANT_PROFILE_ID =
  "00000000-0000-4000-8000-000000000168";
const ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID =
  "00000000-0000-4000-8000-000000000169";

const mocks = vi.hoisted(() => ({
  personas: {} as Record<string, Persona>,
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  prisma: {
    user: {
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    participantProfile: {
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    diagnosisResult: {
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    organizationProfile: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    opportunity: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    matchingCandidate: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    approach: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    certificate: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    accountDeletionRequest: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: mocks.listUsers,
        createUser: mocks.createUser,
        updateUserById: mocks.updateUserById,
        deleteUser: mocks.deleteUser,
      },
    },
  }),
}));

vi.mock("@/lib/test-auth/personas", () => ({
  PERSONAS: mocks.personas,
}));

import { seedE2eUsers } from "./seed-e2e";

// seedへ渡す入力fixture。期待値は下のassertで独立して指定する。
const personaCases = [
  ["participant-fresh", "participant", "e2e-participant-fresh@example.com", "fresh"],
  ["participant-onboarded", "participant", "e2e-participant-onboarded@example.com", "onboarded"],
  ["participant-diagnosis", "participant", "e2e-participant-diagnosis@example.com", "diagnosis"],
  ["participant-lifecycle", "participant", "e2e-participant-lifecycle@example.com", "lifecycle"],
  ["participant-delete", "participant", "e2e-participant-delete@example.com", "delete"],
  ["participant-deletion-pending", "participant", "e2e-participant-deletion-pending@example.com", "deletion pending"],
  ["participant-logout", "participant", "e2e-participant-logout@example.com", "logout"],
  ["user-suspendable", "participant", "e2e-user-suspendable@example.com", "suspendable"],
  ["participant-suspended", "participant", "e2e-participant-suspended@example.com", "suspended"],
  ["organization-approved", "organization", "e2e-org-approved@example.com", "approved"],
  ["organization-pending", "organization", "e2e-org-pending@example.com", "pending"],
  ["organization-review-approve", "organization", "e2e-org-review-approve@example.com", "review approve"],
  ["organization-review-reject", "organization", "e2e-org-review-reject@example.com", "review reject"],
  ["organization-fresh", "organization", "e2e-org-fresh@example.com", "fresh"],
  ["organization-reapply", "organization", "e2e-org-reapply@example.com", "reapply"],
  ["organization-profile-review", "organization", "e2e-org-profile-review@example.com", "profile review"],
  ["organization-lifecycle", "organization", "e2e-org-lifecycle@example.com", "lifecycle"],
  ["organization-foreign", "organization", "e2e-org-foreign@example.com", "foreign"],
  ["organization-pending-readonly", "organization", "e2e-org-pending-readonly@example.com", "pending readonly"],
  ["organization-rejected", "organization", "e2e-org-rejected@example.com", "rejected"],
  ["organization-secondary", "organization", "e2e-org-secondary@example.com", "secondary"],
  ["admin", "admin", "e2e-admin@example.com", "管理者ロール"],
  ["admin-review", "admin", "e2e-admin-review@example.com", "admin review"],
] as const satisfies readonly (readonly [PersonaKey, Persona["role"], string, string])[];

const personaDefinitions = Object.fromEntries(
  personaCases.map(([key, role, email, description]) => [key, { key, role, email, description }]),
);

function personaId(key: string): string {
  return `${key}-id`;
}

function personaByEmail(email: string) {
  return Object.values(mocks.personas).find((persona) => persona.email === email);
}

function createResult(id: string, email: string) {
  return { data: { user: { id, email } }, error: null };
}

describe("seedE2eUsers", () => {
  const originalPassword = process.env.E2E_TEST_USER_PASSWORD;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mocks.personas)) {
      delete mocks.personas[key];
    }
    Object.assign(mocks.personas, personaDefinitions);
    process.env.E2E_TEST_USER_PASSWORD = "password";
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mocks.createUser.mockImplementation(async ({ email }: { email: string }) =>
      createResult(personaId(personaByEmail(email)?.key ?? email), email)
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: {} }, error: null });
    mocks.deleteUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.prisma.user.upsert.mockResolvedValue({});
    mocks.prisma.user.update.mockResolvedValue({});
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.user.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.participantProfile.upsert.mockImplementation(
      async ({
        where,
        create,
      }: {
        where: { userId: string };
        create: { id?: string };
      }) => ({
        id: create.id ?? `${where.userId}-profile-id`,
      })
    );
    mocks.prisma.participantProfile.update.mockResolvedValue({});
    mocks.prisma.participantProfile.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.diagnosisResult.findFirst.mockResolvedValue(null);
    mocks.prisma.diagnosisResult.create.mockImplementation(
      async ({ data }: { data: { userId: string } }) => ({
        id: `diagnosis-${data.userId}`,
      })
    );
    mocks.prisma.diagnosisResult.upsert.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({ id: where.id })
    );
    mocks.prisma.diagnosisResult.update.mockResolvedValue({});
    mocks.prisma.diagnosisResult.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.organizationProfile.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.organizationProfile.upsert.mockImplementation(
      async ({ where }: { where: { userId: string } }) => {
        const ids: Record<string, string> = {
          [personaId("organization-approved")]: "approved-org-id",
          [personaId("organization-lifecycle")]: "lifecycle-org-id",
          [personaId("organization-foreign")]: "foreign-org-id",
        };
        return { id: ids[where.userId] ?? `${where.userId}-profile-id` };
      }
    );
    mocks.prisma.opportunity.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.opportunity.findFirst.mockResolvedValue(null);
    mocks.prisma.opportunity.create.mockImplementation(
      async ({ data }: { data: { title: string } }) => ({
        id: `opportunity-${data.title}`,
      })
    );
    mocks.prisma.opportunity.update.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({ id: where.id })
    );
    mocks.prisma.matchingCandidate.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.matchingCandidate.upsert.mockImplementation(
      async ({
        where,
      }: {
        where: {
          participantId_opportunityId: {
            participantId: string;
            opportunityId: string;
          };
        };
      }) => ({
        id: `candidate-${where.participantId_opportunityId.participantId}-${where.participantId_opportunityId.opportunityId}`,
      })
    );
    mocks.prisma.approach.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.approach.upsert.mockResolvedValue({});
    mocks.prisma.certificate.upsert.mockResolvedValue({});
    mocks.prisma.certificate.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.accountDeletionRequest.upsert.mockResolvedValue({});
    mocks.prisma.accountDeletionRequest.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.E2E_TEST_USER_PASSWORD;
    } else {
      process.env.E2E_TEST_USER_PASSWORD = originalPassword;
    }
    consoleLogSpy.mockRestore();
  });

  it("E2E_TEST_USER_PASSWORD が未設定の場合は失敗する", async () => {
    delete process.env.E2E_TEST_USER_PASSWORD;

    await expect(seedE2eUsers()).rejects.toThrow(
      "E2E_TEST_USER_PASSWORD が未設定です"
    );
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("既存 auth ユーザーは metadata を更新する", async () => {
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "existing-participant-fresh-id",
            email: personaDefinitions["participant-fresh"].email,
          },
        ],
      },
      error: null,
    });

    await seedE2eUsers();

    expect(mocks.updateUserById).toHaveBeenCalledWith(
      "existing-participant-fresh-id",
      {
        password: "password",
        user_metadata: {
          full_name: "E2E participant-fresh",
          role: null,
          onboarding_completed: false,
        },
      }
    );
  });

  it("新規 auth ユーザーは email_confirm と metadata 付きで作成する", async () => {
    await seedE2eUsers();

    expect(mocks.createUser).toHaveBeenCalledWith({
      email: personaDefinitions["participant-onboarded"].email,
      password: "password",
      email_confirm: true,
      user_metadata: {
        full_name: "E2E participant-onboarded",
        role: "participant",
        onboarding_completed: true,
      },
    });
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: personaDefinitions["organization-fresh"].email,
      password: "password",
      email_confirm: true,
      user_metadata: {
        full_name: "E2E organization-fresh",
        role: null,
        onboarding_completed: false,
      },
    });
  });

  it("前回の cleanup 保留 persona を台帳と業務ユーザーから清掃する", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "stale-pending-id" }]);

    await seedE2eUsers();

    expect(mocks.prisma.accountDeletionRequest.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ["stale-pending-id"] } },
    });
    expect(mocks.prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["stale-pending-id"] } },
    });
  });

  it("auth ユーザー一覧取得エラーを伝播する", async () => {
    mocks.listUsers.mockResolvedValue({
      data: { users: [] },
      error: { message: "list failed" },
    });

    await expect(seedE2eUsers()).rejects.toThrow(
      "[seed] ユーザー一覧取得失敗: list failed"
    );
  });

  it("統合済みE2E fixtureを新schemaで作成する", async () => {
    await seedE2eUsers();

    expect(mocks.prisma.participantProfile.deleteMany).toHaveBeenCalledWith({
      where: { userId: personaId("participant-fresh") },
    });
    expect(mocks.prisma.diagnosisResult.deleteMany).toHaveBeenCalledWith({
      where: { userId: personaId("participant-fresh") },
    });
    expect(mocks.prisma.organizationProfile.deleteMany).toHaveBeenCalledWith({
      where: { userId: personaId("organization-fresh") },
    });

    expect(mocks.prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: ORGANIZATION_FIXTURE_PARTICIPANT_ID },
      update: expect.objectContaining({
        email: "e2e-organization-fixture-participant@example.com",
        role: "participant",
      }),
      create: expect.objectContaining({
        id: ORGANIZATION_FIXTURE_PARTICIPANT_ID,
        role: "participant",
      }),
    });
    expect(mocks.prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: personaId("admin-review") },
      update: {
        role: "admin",
        email: "e2e-admin-review@example.com",
        name: "E2E admin-review",
      },
      create: {
        id: personaId("admin-review"),
        email: "e2e-admin-review@example.com",
        name: "E2E admin-review",
        role: "admin",
      },
    });
    expect(mocks.prisma.participantProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: ORGANIZATION_FIXTURE_PARTICIPANT_ID },
        create: expect.objectContaining({
          id: ORGANIZATION_FIXTURE_PARTICIPANT_PROFILE_ID,
        }),
      })
    );
    expect(mocks.prisma.participantProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("user-suspendable") },
        update: expect.objectContaining({
          name: "E2E 凍結対象参加者",
          birthday: new Date("1997-09-08"),
          region: "東京都",
          publicProfile: false,
        }),
      })
    );
    expect(mocks.prisma.diagnosisResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID },
        create: expect.objectContaining({
          id: ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID,
          styleTypeId: "supporter-care",
        }),
      })
    );
    expect(mocks.prisma.participantProfile.update).toHaveBeenCalledWith({
      where: { userId: ORGANIZATION_FIXTURE_PARTICIPANT_ID },
      data: { latestDiagnosisResultId: ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID },
    });

    expect(mocks.prisma.diagnosisResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scaleCode: expect.any(String),
        scaleVersion: expect.any(String),
        scoringAlgorithmVersion: expect.any(String),
        qualityRuleVersion: expect.any(String),
        styleTypeVersion: expect.any(String),
        rawScores: expect.objectContaining({ agreeableness: 46 }),
        scaledScores: expect.objectContaining({ agreeableness: 90 }),
        styleTypeId: "supporter-care",
        qualityFlags: [],
      }),
      select: { id: true },
    });
    const diagnosisCreatePayloads = mocks.prisma.diagnosisResult.create.mock.calls.map(
      ([arg]) => arg.data
    );
    for (const payload of diagnosisCreatePayloads) {
      expect(payload).not.toHaveProperty("big5Scores");
      expect(payload).not.toHaveProperty("personalityTypeId");
      expect(payload).not.toHaveProperty("diagnosisMode");
    }

    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-reapply") },
        create: expect.objectContaining({ reviewStatus: "rejected" }),
      })
    );
    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-lifecycle") },
        create: expect.objectContaining({ reviewStatus: "approved" }),
      })
    );
    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-pending-readonly") },
        create: expect.objectContaining({ reviewStatus: "pending" }),
      })
    );
    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-pending") },
        update: expect.objectContaining({
          organizationName: "E2E一覧承認団体",
          reviewStatus: "pending",
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
        }),
      })
    );
    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-review-approve") },
        update: expect.objectContaining({
          organizationName: "E2E詳細承認団体",
          reviewStatus: "pending",
          verified: false,
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
          representativeName: "E2E承認代表",
          contactEmail: "e2e-review-approve-contact@example.com",
        }),
      })
    );
    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-review-reject") },
        update: expect.objectContaining({
          organizationName: "E2E詳細否認団体",
          reviewStatus: "pending",
          verified: false,
          reviewComment: null,
          reviewedAt: null,
          reviewedBy: null,
          representativeName: "E2E否認代表",
          contactEmail: "e2e-review-reject-contact@example.com",
          contactLineId: "@e2e-review-reject",
          contactLineUrl: "https://line.me/R/ti/p/@e2e-review-reject",
        }),
      })
    );
    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "00000000-0000-4000-8000-000000000173" },
        update: expect.objectContaining({
          organizationName: "E2Eフィルター否認済み団体",
          reviewStatus: "rejected",
          reviewComment: "E2Eフィルター否認理由",
          reviewedBy: personaId("admin-review"),
        }),
      })
    );
    expect(mocks.prisma.organizationProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-secondary") },
        create: expect.objectContaining({ reviewStatus: "approved" }),
      })
    );

    expect(mocks.prisma.opportunity.deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: "lifecycle-org-id",
        title: { startsWith: "E2E 団体案件管理" },
      },
    });
    expect(mocks.prisma.opportunity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "lifecycle-org-id",
        title: "E2E 団体おすすめ高相性案件",
        activityStyleTags: ["empathy-support"],
      }),
    });
    for (const [arg] of mocks.prisma.opportunity.create.mock.calls) {
      expect(arg.data).not.toHaveProperty("requirementTraits");
    }
    for (const [arg] of mocks.prisma.opportunity.update.mock.calls) {
      expect(arg.data).not.toHaveProperty("requirementTraits");
    }

    expect(mocks.prisma.matchingCandidate.deleteMany).toHaveBeenCalledWith({
      where: {
        participantId: {
          not: ORGANIZATION_FIXTURE_PARTICIPANT_ID,
        },
        opportunityId: {
          in: expect.arrayContaining([
            "opportunity-E2E 団体応募辞退案件",
            "opportunity-E2E 団体活動完了案件",
          ]),
        },
      },
    });
    for (const [arg] of mocks.prisma.matchingCandidate.upsert.mock.calls) {
      expect(arg.create).not.toHaveProperty("matchScore");
      expect(arg.create).not.toHaveProperty("diagnosisResultId");
      expect(arg.update).not.toHaveProperty("matchScore");
      expect(arg.update).not.toHaveProperty("diagnosisResultId");
    }

    expect(mocks.prisma.approach.deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: "lifecycle-org-id",
        participantProfileId: {
          not: ORGANIZATION_FIXTURE_PARTICIPANT_PROFILE_ID,
        },
        opportunityId: expect.objectContaining({
          in: expect.arrayContaining([
            "opportunity-E2E 団体アプローチ送信案件",
          ]),
        }),
      },
    });
    for (const [arg] of mocks.prisma.approach.upsert.mock.calls) {
      expect(arg.create).not.toHaveProperty("matchScore");
      expect(arg.update).not.toHaveProperty("matchScore");
    }

    expect(mocks.prisma.certificate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          applicationId:
            "candidate-00000000-0000-4000-8000-000000000167-opportunity-E2E 団体証明書承認案件",
        },
        create: expect.objectContaining({ status: "pending" }),
      })
    );
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: personaId("user-suspendable") },
      data: expect.objectContaining({ isActive: true, suspendReason: null }),
    });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: personaId("participant-suspended") },
      data: expect.objectContaining({
        isActive: false,
        suspendReason: "E2E凍結ユーザー",
      }),
    });
  });
});
