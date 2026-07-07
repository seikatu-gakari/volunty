import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORGANIZATION_FIXTURE_PARTICIPANT_ID =
  "00000000-0000-4000-8000-000000000167";
const ORGANIZATION_FIXTURE_PARTICIPANT_PROFILE_ID =
  "00000000-0000-4000-8000-000000000168";
const ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID =
  "00000000-0000-4000-8000-000000000169";

const mocks = vi.hoisted(() => ({
  personas: {
    admin: {
      key: "admin",
      email: "e2e-admin@example.com",
      role: "admin",
      description: "管理者ロール",
    },
  } as Record<
    string,
    {
      key: string;
      email: string;
      role: "participant" | "organization" | "admin";
      description: string;
    }
  >,
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  userUpsert: vi.fn(),
  userUpdate: vi.fn(),
  participantProfileUpsert: vi.fn(),
  participantProfileUpdate: vi.fn(),
  participantProfileDeleteMany: vi.fn(),
  diagnosisResultFindFirst: vi.fn(),
  diagnosisResultCreate: vi.fn(),
  diagnosisResultUpsert: vi.fn(),
  diagnosisResultUpdate: vi.fn(),
  diagnosisResultDeleteMany: vi.fn(),
  organizationProfileDeleteMany: vi.fn(),
  organizationProfileUpsert: vi.fn(),
  opportunityDeleteMany: vi.fn(),
  opportunityFindFirst: vi.fn(),
  opportunityCreate: vi.fn(),
  opportunityUpdate: vi.fn(),
  matchingCandidateDeleteMany: vi.fn(),
  matchingCandidateUpsert: vi.fn(),
  approachDeleteMany: vi.fn(),
  approachUpsert: vi.fn(),
  certificateUpsert: vi.fn(),
  certificateDeleteMany: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { upsert: mocks.userUpsert, update: mocks.userUpdate },
    participantProfile: {
      upsert: mocks.participantProfileUpsert,
      update: mocks.participantProfileUpdate,
      deleteMany: mocks.participantProfileDeleteMany,
    },
    diagnosisResult: {
      findFirst: mocks.diagnosisResultFindFirst,
      create: mocks.diagnosisResultCreate,
      upsert: mocks.diagnosisResultUpsert,
      update: mocks.diagnosisResultUpdate,
      deleteMany: mocks.diagnosisResultDeleteMany,
    },
    organizationProfile: {
      deleteMany: mocks.organizationProfileDeleteMany,
      upsert: mocks.organizationProfileUpsert,
    },
    opportunity: {
      deleteMany: mocks.opportunityDeleteMany,
      findFirst: mocks.opportunityFindFirst,
      create: mocks.opportunityCreate,
      update: mocks.opportunityUpdate,
    },
    matchingCandidate: {
      deleteMany: mocks.matchingCandidateDeleteMany,
      upsert: mocks.matchingCandidateUpsert,
    },
    approach: {
      deleteMany: mocks.approachDeleteMany,
      upsert: mocks.approachUpsert,
    },
    certificate: {
      upsert: mocks.certificateUpsert,
      deleteMany: mocks.certificateDeleteMany,
    },
    $disconnect: mocks.disconnect,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: mocks.listUsers,
        createUser: mocks.createUser,
        updateUserById: mocks.updateUserById,
      },
    },
  }),
}));

vi.mock("@/lib/test-auth/personas", () => ({
  PERSONAS: mocks.personas,
}));

import { seedE2eUsers } from "./seed-e2e";

const personaDefinitions = {
  "participant-fresh": {
    key: "participant-fresh",
    email: "e2e-participant-fresh@example.com",
    role: "participant",
    description: "fresh",
  },
  "participant-onboarded": {
    key: "participant-onboarded",
    email: "e2e-participant-onboarded@example.com",
    role: "participant",
    description: "onboarded",
  },
  "participant-diagnosis": {
    key: "participant-diagnosis",
    email: "e2e-participant-diagnosis@example.com",
    role: "participant",
    description: "diagnosis",
  },
  "participant-lifecycle": {
    key: "participant-lifecycle",
    email: "e2e-participant-lifecycle@example.com",
    role: "participant",
    description: "lifecycle",
  },
  "participant-delete": {
    key: "participant-delete",
    email: "e2e-participant-delete@example.com",
    role: "participant",
    description: "delete",
  },
  "participant-logout": {
    key: "participant-logout",
    email: "e2e-participant-logout@example.com",
    role: "participant",
    description: "logout",
  },
  "user-suspendable": {
    key: "user-suspendable",
    email: "e2e-user-suspendable@example.com",
    role: "participant",
    description: "suspendable",
  },
  "participant-suspended": {
    key: "participant-suspended",
    email: "e2e-participant-suspended@example.com",
    role: "participant",
    description: "suspended",
  },
  "organization-approved": {
    key: "organization-approved",
    email: "e2e-org-approved@example.com",
    role: "organization",
    description: "approved",
  },
  "organization-pending": {
    key: "organization-pending",
    email: "e2e-org-pending@example.com",
    role: "organization",
    description: "pending",
  },
  "organization-review-approve": {
    key: "organization-review-approve",
    email: "e2e-org-review-approve@example.com",
    role: "organization",
    description: "review approve",
  },
  "organization-review-reject": {
    key: "organization-review-reject",
    email: "e2e-org-review-reject@example.com",
    role: "organization",
    description: "review reject",
  },
  "organization-fresh": {
    key: "organization-fresh",
    email: "e2e-org-fresh@example.com",
    role: "organization",
    description: "fresh",
  },
  "organization-reapply": {
    key: "organization-reapply",
    email: "e2e-org-reapply@example.com",
    role: "organization",
    description: "reapply",
  },
  "organization-profile-review": {
    key: "organization-profile-review",
    email: "e2e-org-profile-review@example.com",
    role: "organization",
    description: "profile review",
  },
  "organization-lifecycle": {
    key: "organization-lifecycle",
    email: "e2e-org-lifecycle@example.com",
    role: "organization",
    description: "lifecycle",
  },
  "organization-foreign": {
    key: "organization-foreign",
    email: "e2e-org-foreign@example.com",
    role: "organization",
    description: "foreign",
  },
  "organization-pending-readonly": {
    key: "organization-pending-readonly",
    email: "e2e-org-pending-readonly@example.com",
    role: "organization",
    description: "pending readonly",
  },
  "organization-rejected": {
    key: "organization-rejected",
    email: "e2e-org-rejected@example.com",
    role: "organization",
    description: "rejected",
  },
  "organization-secondary": {
    key: "organization-secondary",
    email: "e2e-org-secondary@example.com",
    role: "organization",
    description: "secondary",
  },
  admin: {
    key: "admin",
    email: "e2e-admin@example.com",
    role: "admin",
    description: "管理者ロール",
  },
  "admin-review": {
    key: "admin-review",
    email: "e2e-admin-review@example.com",
    role: "admin",
    description: "admin review",
  },
} as const;

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
    mocks.userUpsert.mockResolvedValue({});
    mocks.userUpdate.mockResolvedValue({});
    mocks.participantProfileUpsert.mockImplementation(
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
    mocks.participantProfileUpdate.mockResolvedValue({});
    mocks.participantProfileDeleteMany.mockResolvedValue({ count: 0 });
    mocks.diagnosisResultFindFirst.mockResolvedValue(null);
    mocks.diagnosisResultCreate.mockImplementation(
      async ({ data }: { data: { userId: string } }) => ({
        id: `diagnosis-${data.userId}`,
      })
    );
    mocks.diagnosisResultUpsert.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({ id: where.id })
    );
    mocks.diagnosisResultUpdate.mockResolvedValue({});
    mocks.diagnosisResultDeleteMany.mockResolvedValue({ count: 0 });
    mocks.organizationProfileDeleteMany.mockResolvedValue({ count: 0 });
    mocks.organizationProfileUpsert.mockImplementation(
      async ({ where }: { where: { userId: string } }) => {
        const ids: Record<string, string> = {
          [personaId("organization-approved")]: "approved-org-id",
          [personaId("organization-lifecycle")]: "lifecycle-org-id",
          [personaId("organization-foreign")]: "foreign-org-id",
        };
        return { id: ids[where.userId] ?? `${where.userId}-profile-id` };
      }
    );
    mocks.opportunityDeleteMany.mockResolvedValue({ count: 0 });
    mocks.opportunityFindFirst.mockResolvedValue(null);
    mocks.opportunityCreate.mockImplementation(
      async ({ data }: { data: { title: string } }) => ({
        id: `opportunity-${data.title}`,
      })
    );
    mocks.opportunityUpdate.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({ id: where.id })
    );
    mocks.matchingCandidateDeleteMany.mockResolvedValue({ count: 0 });
    mocks.matchingCandidateUpsert.mockImplementation(
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
    mocks.approachDeleteMany.mockResolvedValue({ count: 0 });
    mocks.approachUpsert.mockResolvedValue({});
    mocks.certificateUpsert.mockResolvedValue({});
    mocks.certificateDeleteMany.mockResolvedValue({ count: 0 });
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

    expect(mocks.participantProfileDeleteMany).toHaveBeenCalledWith({
      where: { userId: personaId("participant-fresh") },
    });
    expect(mocks.diagnosisResultDeleteMany).toHaveBeenCalledWith({
      where: { userId: personaId("participant-fresh") },
    });
    expect(mocks.organizationProfileDeleteMany).toHaveBeenCalledWith({
      where: { userId: personaId("organization-fresh") },
    });

    expect(mocks.userUpsert).toHaveBeenCalledWith({
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
    expect(mocks.userUpsert).toHaveBeenCalledWith({
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
    expect(mocks.participantProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: ORGANIZATION_FIXTURE_PARTICIPANT_ID },
        create: expect.objectContaining({
          id: ORGANIZATION_FIXTURE_PARTICIPANT_PROFILE_ID,
        }),
      })
    );
    expect(mocks.diagnosisResultUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID },
        create: expect.objectContaining({
          id: ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID,
          styleTypeId: "supporter-care",
        }),
      })
    );
    expect(mocks.participantProfileUpdate).toHaveBeenCalledWith({
      where: { userId: ORGANIZATION_FIXTURE_PARTICIPANT_ID },
      data: { latestDiagnosisResultId: ORGANIZATION_FIXTURE_DIAGNOSIS_RESULT_ID },
    });

    expect(mocks.diagnosisResultCreate).toHaveBeenCalledWith({
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
    const diagnosisCreatePayloads = mocks.diagnosisResultCreate.mock.calls.map(
      ([arg]) => arg.data
    );
    for (const payload of diagnosisCreatePayloads) {
      expect(payload).not.toHaveProperty("big5Scores");
      expect(payload).not.toHaveProperty("personalityTypeId");
      expect(payload).not.toHaveProperty("diagnosisMode");
    }

    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-reapply") },
        create: expect.objectContaining({ reviewStatus: "rejected" }),
      })
    );
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-lifecycle") },
        create: expect.objectContaining({ reviewStatus: "approved" }),
      })
    );
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-pending-readonly") },
        create: expect.objectContaining({ reviewStatus: "pending" }),
      })
    );
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
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
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
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
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
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
        }),
      })
    );
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
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
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: personaId("organization-secondary") },
        create: expect.objectContaining({ reviewStatus: "approved" }),
      })
    );

    expect(mocks.opportunityDeleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: "lifecycle-org-id",
        title: { startsWith: "E2E 団体案件管理" },
      },
    });
    expect(mocks.opportunityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "lifecycle-org-id",
        title: "E2E 団体おすすめ高相性案件",
        activityStyleTags: ["empathy-support"],
      }),
    });
    for (const [arg] of mocks.opportunityCreate.mock.calls) {
      expect(arg.data).not.toHaveProperty("requirementTraits");
    }
    for (const [arg] of mocks.opportunityUpdate.mock.calls) {
      expect(arg.data).not.toHaveProperty("requirementTraits");
    }

    expect(mocks.matchingCandidateDeleteMany).toHaveBeenCalledWith({
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
    for (const [arg] of mocks.matchingCandidateUpsert.mock.calls) {
      expect(arg.create).not.toHaveProperty("matchScore");
      expect(arg.create).not.toHaveProperty("diagnosisResultId");
      expect(arg.update).not.toHaveProperty("matchScore");
      expect(arg.update).not.toHaveProperty("diagnosisResultId");
    }

    expect(mocks.approachDeleteMany).toHaveBeenCalledWith({
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
    for (const [arg] of mocks.approachUpsert.mock.calls) {
      expect(arg.create).not.toHaveProperty("matchScore");
      expect(arg.update).not.toHaveProperty("matchScore");
    }

    expect(mocks.certificateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          applicationId:
            "candidate-00000000-0000-4000-8000-000000000167-opportunity-E2E 団体証明書承認案件",
        },
        create: expect.objectContaining({ status: "pending" }),
      })
    );
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: personaId("user-suspendable") },
      data: expect.objectContaining({ isActive: true, suspendReason: null }),
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: personaId("participant-suspended") },
      data: expect.objectContaining({
        isActive: false,
        suspendReason: "E2E凍結ユーザー",
      }),
    });
  });
});
