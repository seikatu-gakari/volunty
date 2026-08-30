import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  getViewerContext: vi.fn(),
  header: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mocks.getUser(),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  }),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: () => mocks.getViewerContext(),
}));

vi.mock("@/app/components/Header", () => ({
  Header: ({ viewerContext }: { viewerContext?: unknown }) => {
    mocks.header(viewerContext);
    return <header>ヘッダー</header>;
  },
}));

vi.mock("./components/DiagnosisWizard", () => ({
  DiagnosisWizard: () => <div>診断ウィザード</div>,
}));

import DiagnosisPage from "./page";

describe("DiagnosisPage", () => {
  const participantViewer = {
    status: "authenticated" as const,
    identity: {
      id: "participant-user-1",
      email: "participant@example.com",
      displayName: "参加者",
    },
    role: "participant" as const,
    isActive: true,
    hasParticipantProfile: true,
    hasOrganizationProfile: false,
    organizationVerified: false,
    organizationReviewStatus: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue(participantViewer);
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "participant-user-1",
          user_metadata: {},
        },
      },
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { role: "participant" },
    });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("participantのPageとHeaderは同じViewerContextを共有し、旧getUserとm_user照会を再実行しない", async () => {
    const page = await DiagnosisPage();
    render(page);

    expect(screen.getByText("診断ウィザード")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getViewerContext).toHaveBeenCalledOnce();
    expect(mocks.header).toHaveBeenCalledWith(participantViewer);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("ViewerContext errorを未認証としてログインへは送らない", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "error",
      errorCode: "account_lookup_failed",
    });

    await expect(DiagnosisPage()).rejects.toThrow(
      "閲覧者情報を確認できませんでした"
    );

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
