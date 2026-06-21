import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingOrganization } from "@/lib/admin/actions";
import { OrganizationReviewDetail } from "./OrganizationReviewDetail";

const mocks = vi.hoisted(() => ({
  approveOrganization: vi.fn(),
  rejectOrganization: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/lib/admin/actions", () => ({
  approveOrganization: (...args: unknown[]) =>
    mocks.approveOrganization(...args),
  rejectOrganization: (...args: unknown[]) => mocks.rejectOrganization(...args),
}));

function organization(
  override: Partial<PendingOrganization> = {}
): PendingOrganization {
  return {
    id: "org-1",
    userId: "user-1",
    organizationName: "テスト団体",
    representativeName: "担当者",
    contactEmail: "org@example.com",
    activityAreas: ["東京都"],
    description: "団体説明",
    activityCategories: ["子ども支援"],
    websiteUrl: "https://example.com",
    profileCompleteness: 80,
    reviewStatus: "pending",
    reviewComment: null,
    reviewedAt: null,
    reviewedBy: null,
    verified: false,
    createdAt: "2026-04-17T10:00:00.000Z",
    ...override,
  };
}

describe("OrganizationReviewDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("団体詳細と却下理由入力付きの操作を表示する", () => {
    render(<OrganizationReviewDetail organization={organization()} />);

    expect(
      screen.getByRole("heading", { name: "テスト団体" })
    ).toBeDefined();
    expect(screen.getByText("代表者:")).toBeDefined();
    expect(screen.getByText("東京都")).toBeDefined();
    expect(screen.getByText("子ども支援")).toBeDefined();
    expect(screen.getByLabelText("却下理由")).toBeDefined();
    expect(
      (screen.getByRole("button", { name: /否認する/ }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("却下理由を入力すると否認アクションを実行して一覧へ戻る", async () => {
    mocks.rejectOrganization.mockResolvedValue({ success: true });

    render(<OrganizationReviewDetail organization={organization()} />);

    fireEvent.change(screen.getByLabelText("却下理由"), {
      target: { value: "情報を補足してください" },
    });
    fireEvent.click(screen.getByRole("button", { name: /否認する/ }));

    await waitFor(() => {
      expect(mocks.rejectOrganization).toHaveBeenCalledWith(
        "org-1",
        "情報を補足してください"
      );
    });
    expect(mocks.push).toHaveBeenCalledWith("/admin/reviews");
  });

  it("審査済みの団体では操作フォームを表示しない", () => {
    render(
      <OrganizationReviewDetail
        organization={organization({
          reviewStatus: "approved",
          verified: true,
          reviewedAt: "2026-04-18T10:00:00.000Z",
          reviewedBy: "admin-1",
        })}
      />
    );

    expect(screen.queryByLabelText("却下理由")).toBeNull();
    expect(
      (screen.getByRole("button", { name: /承認済み/ }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
