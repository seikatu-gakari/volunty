import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  userFindUnique: vi.fn(),
  fetchParticipantProfileByUserId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mocks.getUser(),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/participant-profile/server", () => ({
  fetchParticipantProfileByUserId: (...args: unknown[]) =>
    mocks.fetchParticipantProfileByUserId(...args),
}));

vi.mock("./components/ParticipantProfileForm", () => ({
  ParticipantProfileForm: () => null,
}));

import OnboardingParticipantPage from "./page";

describe("OnboardingParticipantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockReturnValue({
      data: {
        user: {
          id: "participant-user-123",
          user_metadata: { role: "participant" },
        },
      },
    });
    mocks.userFindUnique.mockResolvedValue({ role: "participant" });
    mocks.fetchParticipantProfileByUserId.mockResolvedValue(null);
  });

  it("participant ロールかつプロフィール未登録の場合、参加者フォームを表示する", async () => {
    await expect(OnboardingParticipantPage()).resolves.toBeDefined();

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "participant-user-123" },
      select: { role: true },
    });
    expect(mocks.fetchParticipantProfileByUserId).toHaveBeenCalledWith(
      "participant-user-123"
    );
  });

  it("organization ロールの場合、団体オンボーディングへリダイレクトする", async () => {
    mocks.getUser.mockReturnValue({
      data: {
        user: {
          id: "organization-user-123",
          user_metadata: { role: "participant" },
        },
      },
    });
    mocks.userFindUnique.mockResolvedValue({ role: "organization" });

    await expect(OnboardingParticipantPage()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/organization"
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/organization");
    expect(mocks.fetchParticipantProfileByUserId).not.toHaveBeenCalled();
  });

  it("ロール未選択の場合、ロール選択画面へリダイレクトする", async () => {
    mocks.getUser.mockReturnValue({
      data: {
        user: {
          id: "no-role-user-123",
          user_metadata: {},
        },
      },
    });
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(OnboardingParticipantPage()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/role"
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/role");
    expect(mocks.fetchParticipantProfileByUserId).not.toHaveBeenCalled();
  });

  it("participant ロールでプロフィール登録済みの場合、トップへリダイレクトする", async () => {
    mocks.fetchParticipantProfileByUserId.mockResolvedValue({
      id: "participant-profile-123",
    });

    await expect(OnboardingParticipantPage()).rejects.toThrow(
      "NEXT_REDIRECT:/"
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });
});
