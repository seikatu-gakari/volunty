import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getViewerContext: vi.fn(),
  fetchMyApproachDetail: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    mocks.notFound();
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: () => mocks.getViewerContext(),
}));

vi.mock("@/lib/approaches/queries", () => ({
  fetchMyApproachDetailQuery: (...args: unknown[]) =>
    mocks.fetchMyApproachDetail(...args),
}));

vi.mock("./ApproachResponseActions", () => ({
  ApproachResponseActions: () => <div>回答フォーム</div>,
}));

import MyApproachDetailPage from "./page";

describe("MyApproachDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      identity: {
        id: "participant-user-1",
        email: "participant@example.com",
        displayName: "参加者",
      },
      role: "participant",
      isActive: true,
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
      organizationVerified: false,
      organizationReviewStatus: null,
    });
    mocks.fetchMyApproachDetail.mockResolvedValue({
      approach: {
        id: "approach-1",
        status: "accepted",
        message: "ぜひ参加してください",
        matchScore: 92,
        createdAt: "2026-06-16T10:00:00.000Z",
        expiresAt: "2026-06-30T00:00:00.000Z",
        respondedAt: "2026-06-16T11:00:00.000Z",
        isExpired: false,
        opportunityId: "opportunity-1",
        opportunityTitle: "地域イベント運営",
        organizationName: "テスト団体",
        contact: {
          email: "contact@example.org",
          lineId: "@volunty",
          lineUrl: "https://line.me/R/ti/p/@volunty",
        },
        hasContact: true,
      },
      error: undefined,
    });
  });

  it("承諾済みアプローチではLINE友だち追加リンクとQRを表示する", async () => {
    const page = await MyApproachDetailPage({
      params: Promise.resolve({ id: "approach-1" }),
    });
    render(page);

    const link = screen.getByRole("link", { name: /友だち追加/ });
    expect(link.getAttribute("href")).toBe("https://line.me/R/ti/p/@volunty");
    expect(screen.getByLabelText("LINE友だち追加用QRコード")).toBeDefined();
    expect(screen.getByText("@volunty")).toBeDefined();
    expect(screen.getByText("contact@example.org")).toBeDefined();
    expect(mocks.fetchMyApproachDetail).toHaveBeenCalledWith(
      "participant-user-1",
      "approach-1"
    );
  });
});
