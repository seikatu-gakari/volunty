import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getViewerContext: vi.fn(),
  header: vi.fn(),
  fetchMyCertificatesQuery: vi.fn(),
  oldFetchMyCertificates: vi.fn(),
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

vi.mock("@/lib/certificates/queries", () => ({
  fetchMyCertificatesQuery: (...args: unknown[]) =>
    mocks.fetchMyCertificatesQuery(...args),
}));

vi.mock("@/lib/certificates/actions", () => ({
  fetchMyCertificates: () => mocks.oldFetchMyCertificates(),
}));

vi.mock("@/app/components/Header", () => ({
  Header: ({ viewerContext }: { viewerContext?: unknown }) => {
    mocks.header(viewerContext);
    return <header>ヘッダー</header>;
  },
}));

import MyCertificatesPage from "./page";

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

describe("MyCertificatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue(participantViewer);
    mocks.fetchMyCertificatesQuery.mockResolvedValue({ certificates: [] });
    mocks.oldFetchMyCertificates.mockResolvedValue({ certificates: [] });
  });

  it("PageとHeaderでViewerContextを共有し、証明書queryへ検証済みuserIdを渡す", async () => {
    render(await MyCertificatesPage());

    expect(screen.getByRole("heading", { name: "参加証明書" })).toBeDefined();
    expect(mocks.getViewerContext).toHaveBeenCalledOnce();
    expect(mocks.header).toHaveBeenCalledWith(participantViewer);
    expect(mocks.fetchMyCertificatesQuery).toHaveBeenCalledWith(
      participantViewer.identity.id
    );
    expect(mocks.oldFetchMyCertificates).not.toHaveBeenCalled();
  });
});
