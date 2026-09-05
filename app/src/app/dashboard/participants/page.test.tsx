import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getViewerContext: vi.fn(),
  header: vi.fn(),
  fetchRecommendedParticipantsQuery: vi.fn(),
  oldFetchRecommendedParticipants: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: () => mocks.getViewerContext(),
}));

vi.mock("@/lib/dashboard/queries", () => ({
  fetchRecommendedParticipantsQuery: (...args: unknown[]) =>
    mocks.fetchRecommendedParticipantsQuery(...args),
}));

vi.mock("@/lib/dashboard/actions", () => ({
  fetchRecommendedParticipants: () => mocks.oldFetchRecommendedParticipants(),
}));

vi.mock("@/app/components/Header", () => ({
  Header: ({ viewerContext }: { viewerContext?: unknown }) => {
    mocks.header(viewerContext);
    return <header>ヘッダー</header>;
  },
}));

import DashboardParticipantsPage from "./page";

const organizationViewer = {
  status: "authenticated" as const,
  identity: {
    id: "organization-user-1",
    email: "organization@example.com",
    displayName: "団体",
  },
  role: "organization" as const,
  isActive: true,
  hasParticipantProfile: false,
  hasOrganizationProfile: true,
  organizationVerified: true,
  organizationReviewStatus: "approved" as const,
};

describe("DashboardParticipantsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue(organizationViewer);
    mocks.fetchRecommendedParticipantsQuery.mockResolvedValue({
      participants: [],
      emptyReason: "no_published_opportunities",
    });
    mocks.oldFetchRecommendedParticipants.mockResolvedValue({
      participants: [],
      emptyReason: "no_published_opportunities",
    });
  });

  it("PageとHeaderでViewerContextを共有し、read queryへ検証済みuserIdを渡す", async () => {
    render(await DashboardParticipantsPage());

    expect(screen.getByRole("heading", { name: "おすすめ参加者" })).toBeDefined();
    expect(mocks.getViewerContext).toHaveBeenCalledOnce();
    expect(mocks.header).toHaveBeenCalledWith(organizationViewer);
    expect(mocks.fetchRecommendedParticipantsQuery).toHaveBeenCalledWith(
      organizationViewer.identity.id
    );
    expect(mocks.oldFetchRecommendedParticipants).not.toHaveBeenCalled();
  });
});
