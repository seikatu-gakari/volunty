import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  diagnosisResultDeleteMany: vi.fn(),
  organizationProfileUpsert: vi.fn(),
  opportunityFindFirst: vi.fn(),
  opportunityCreate: vi.fn(),
  opportunityUpdate: vi.fn(),
  matchingCandidateDeleteMany: vi.fn(),
  matchingCandidateUpsert: vi.fn(),
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
      deleteMany: mocks.diagnosisResultDeleteMany,
    },
    organizationProfile: { upsert: mocks.organizationProfileUpsert },
    opportunity: {
      findFirst: mocks.opportunityFindFirst,
      create: mocks.opportunityCreate,
      update: mocks.opportunityUpdate,
    },
    matchingCandidate: {
      deleteMany: mocks.matchingCandidateDeleteMany,
      upsert: mocks.matchingCandidateUpsert,
    },
    approach: { upsert: mocks.approachUpsert },
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

describe("seedE2eUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mocks.personas)) {
      delete mocks.personas[key];
    }
    Object.assign(mocks.personas, {
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
      "participant-suspendable": {
        key: "participant-suspendable",
        email: "e2e-participant-suspendable@example.com",
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
    });
    mocks.createUser.mockImplementation(async ({ email }: { email: string }) => ({
      data: { user: { id: `${email}-id`, email } },
      error: null,
    }));
    mocks.userUpsert.mockResolvedValue({});
    mocks.userUpdate.mockResolvedValue({});
    mocks.participantProfileUpsert.mockResolvedValue({});
    mocks.participantProfileUpdate.mockResolvedValue({});
    mocks.participantProfileDeleteMany.mockResolvedValue({ count: 0 });
    mocks.diagnosisResultFindFirst.mockResolvedValue({ id: "diagnosis-id" });
    mocks.diagnosisResultCreate.mockResolvedValue({ id: "diagnosis-id" });
    mocks.diagnosisResultDeleteMany.mockResolvedValue({ count: 0 });
    mocks.organizationProfileUpsert
      .mockResolvedValueOnce({ id: "approved-org-id" })
      .mockResolvedValueOnce({ id: "pending-org-id" });
    mocks.opportunityFindFirst.mockImplementation(
      async ({ where }: { where: { title: string } }) => ({
        id: `existing-${where.title}`,
      })
    );
    mocks.opportunityCreate.mockImplementation(
      async ({ data }: { data: { title: string } }) => ({
        id: `created-${data.title}`,
      })
    );
    mocks.opportunityUpdate.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
    }));
    mocks.matchingCandidateDeleteMany.mockResolvedValue({ count: 0 });
    mocks.matchingCandidateUpsert.mockResolvedValue({ id: "candidate-id" });
    mocks.approachUpsert.mockResolvedValue({ id: "approach-id" });
    mocks.certificateUpsert.mockResolvedValue({ id: "certificate-id" });
    mocks.certificateDeleteMany.mockResolvedValue({ count: 0 });
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "test-password");
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("パスワード未設定の場合は処理を開始しない", async () => {
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "");

    await expect(seedE2eUsers()).rejects.toThrow(
      "E2E_TEST_USER_PASSWORD が未設定です"
    );
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("既存の Auth ユーザーはパスワードを更新して m_user を upsert する", async () => {
    mocks.listUsers.mockResolvedValue({
      data: { users: [{ id: "existing-user", email: "e2e-admin@example.com" }] },
      error: null,
    });
    mocks.updateUserById.mockResolvedValue({ error: null });
    mocks.userUpsert.mockResolvedValue({});

    await seedE2eUsers();

    expect(mocks.updateUserById).toHaveBeenCalledWith("existing-user", {
      password: "test-password",
      user_metadata: {
        full_name: "E2E admin",
        onboarding_completed: true,
        role: "admin",
      },
    });
    expect(mocks.createUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: "e2e-admin@example.com" })
    );
    expect(mocks.userUpsert).toHaveBeenCalledWith({
      where: { id: "existing-user" },
      update: { role: "admin", email: "e2e-admin@example.com" },
      create: {
        id: "existing-user",
        email: "e2e-admin@example.com",
        name: "E2E admin",
        role: "admin",
      },
    });
  });

  it("Auth ユーザーが存在しない場合は作成して m_user を upsert する", async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mocks.createUser.mockResolvedValue({
      data: { user: { id: "new-user", email: "e2e-admin@example.com" } },
      error: null,
    });
    mocks.userUpsert.mockResolvedValue({});

    await seedE2eUsers();

    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "e2e-admin@example.com",
      password: "test-password",
      email_confirm: true,
      user_metadata: {
        full_name: "E2E admin",
        onboarding_completed: true,
        role: "admin",
      },
    });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "new-user" } })
    );
  });

  it("Auth ユーザー一覧の取得失敗を握りつぶさない", async () => {
    mocks.listUsers.mockResolvedValue({
      data: { users: [] },
      error: { message: "list failed" },
    });

    await expect(seedE2eUsers()).rejects.toThrow(
      "[seed] ユーザー一覧取得失敗: list failed"
    );
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("スモークに必要な状態データを作成し、副作用を初期状態へ戻す", async () => {
    const authUsers = Object.values(mocks.personas).map((persona) => ({
      id: `${persona.key}-id`,
      email: persona.email,
    }));
    mocks.listUsers.mockResolvedValue({
      data: { users: authUsers },
      error: null,
    });
    mocks.updateUserById.mockResolvedValue({ error: null });
    mocks.userUpsert.mockResolvedValue({});
    mocks.participantProfileUpsert.mockResolvedValue({ id: "participant-profile-id" });
    mocks.participantProfileUpdate.mockResolvedValue({});
    mocks.diagnosisResultFindFirst.mockResolvedValue(null);
    mocks.diagnosisResultCreate.mockResolvedValue({ id: "diagnosis-id" });
    mocks.diagnosisResultDeleteMany.mockResolvedValue({ count: 0 });
    mocks.organizationProfileUpsert
      .mockReset()
      .mockResolvedValueOnce({ id: "approved-org-id" })
      .mockResolvedValueOnce({ id: "pending-org-id" })
      .mockResolvedValueOnce({ id: "pending-readonly-org-id" })
      .mockResolvedValueOnce({ id: "rejected-org-id" })
      .mockResolvedValueOnce({ id: "secondary-org-id" });
    mocks.opportunityFindFirst.mockReset().mockResolvedValue(null);
    mocks.opportunityCreate.mockImplementation(
      async ({ data }: { data: { title: string } }) => ({
        id: `created-${data.title}`,
      })
    );
    mocks.matchingCandidateDeleteMany.mockResolvedValue({ count: 0 });
    mocks.matchingCandidateUpsert.mockResolvedValue({ id: "candidate-id" });
    mocks.approachUpsert.mockResolvedValue({ id: "approach-id" });
    mocks.certificateUpsert.mockResolvedValue({ id: "certificate-id" });
    mocks.certificateDeleteMany.mockResolvedValue({ count: 0 });
    mocks.userUpdate.mockResolvedValue({});

    await seedE2eUsers();

    expect(mocks.updateUserById).toHaveBeenCalledWith(
      "participant-fresh-id",
      expect.objectContaining({
        user_metadata: {
          full_name: "E2E participant-fresh",
          onboarding_completed: false,
          role: null,
        },
      })
    );
    expect(mocks.participantProfileDeleteMany).toHaveBeenCalledWith({
      where: { userId: "participant-fresh-id" },
    });

    expect(mocks.participantProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "participant-onboarded-id" },
      })
    );
    for (const userId of [
      "participant-diagnosis-id",
      "participant-lifecycle-id",
      "participant-delete-id",
    ]) {
      expect(mocks.participantProfileUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } })
      );
    }
    expect(mocks.diagnosisResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "participant-onboarded-id",
          scaleCode: "ipip-bfm-50-ja",
          styleTypeId: "supporter-care",
        }),
      })
    );
    // 最新診断結果への参照がプロフィールに設定される
    expect(mocks.participantProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "participant-onboarded-id" },
        data: { latestDiagnosisResultId: "diagnosis-id" },
      })
    );
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledTimes(5);
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "organization-pending-readonly-id" },
        update: expect.objectContaining({
          reviewStatus: "pending",
          verified: false,
        }),
      })
    );
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "organization-rejected-id" },
        update: expect.objectContaining({
          reviewStatus: "rejected",
          verified: false,
        }),
      })
    );
    expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "organization-secondary-id" },
        update: expect.objectContaining({
          reviewStatus: "approved",
          verified: true,
        }),
      })
    );
    expect(mocks.opportunityCreate).toHaveBeenCalledTimes(12);
    expect(mocks.matchingCandidateDeleteMany).toHaveBeenCalledWith({
      where: {
        participantId: "participant-onboarded-id",
        opportunityId: "created-E2E 応募対象案件",
      },
    });
    expect(mocks.matchingCandidateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          participantId_opportunityId: {
            participantId: "participant-onboarded-id",
            opportunityId: "created-E2E 団体フロー案件",
          },
        },
        update: expect.objectContaining({ status: "applied" }),
      })
    );
    // 旧マッチングスコアは保存しない
    const candidateCalls = mocks.matchingCandidateUpsert.mock.calls as Array<
      [{ update: Record<string, unknown>; create: Record<string, unknown> }]
    >;
    for (const [args] of candidateCalls) {
      expect(args.update).not.toHaveProperty("matchScore");
      expect(args.create).not.toHaveProperty("matchScore");
    }
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "participant-suspendable-id" },
      data: {
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        suspendedBy: null,
      },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "participant-suspended-id" },
      data: expect.objectContaining({
        isActive: false,
        suspendReason: "E2E凍結ユーザー",
      }),
    });
    expect(mocks.approachUpsert).toHaveBeenCalledTimes(3);
    expect(mocks.certificateUpsert).toHaveBeenCalledTimes(3);
    expect(mocks.certificateDeleteMany).toHaveBeenCalledTimes(1);
  });
});
