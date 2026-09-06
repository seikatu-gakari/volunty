import { expect, it, vi } from "vitest";
import type { ViewerContext } from "@/lib/auth/viewer-context";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));

const findUnique = vi.fn().mockResolvedValue({
  id: "application-1",
  status: "applied",
  message: "参加希望",
  appliedAt: new Date("2026-09-01T00:00:00Z"),
  statusChangedAt: new Date("2026-09-01T00:00:00Z"),
});
const findFirst = vi.fn().mockResolvedValue({ id: "favorite-1" });
const create = vi.fn().mockResolvedValue({});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    matchingCandidate: { findUnique, count: vi.fn() },
    engagementEvent: { findFirst, create },
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { fetchOpportunityViewerState } = await import("./queries");
const { after } = await import("next/server");

it.each(["search", "direct", "recommendation"] as const)("参加者本人の応募・保存状態だけを取得し、閲覧元%sを記録する", async (source) => {
  vi.clearAllMocks();
  const viewer: ViewerContext = {
    status: "authenticated",
    identity: { id: "participant-1", email: null, displayName: null },
    role: "participant",
    isActive: true,
    hasParticipantProfile: true,
    hasOrganizationProfile: false,
    organizationVerified: false,
    organizationReviewStatus: null,
  };

  await expect(fetchOpportunityViewerState("opportunity-1", viewer, source)).resolves.toMatchObject({
    existingApplication: { id: "application-1", status: "pending" },
    isParticipant: true,
    isBookmarked: true,
  });
  expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
    where: {
      participantId_opportunityId: {
        participantId: "participant-1",
        opportunityId: "opportunity-1",
      },
    },
  }));
  const callback = vi.mocked(after).mock.calls.at(-1)?.[0];
  if (typeof callback !== "function") throw new Error("閲覧イベントの記録が予約されていません");
  await callback();
  expect(create).toHaveBeenCalledWith({
    data: { userId: "participant-1", opportunityId: "opportunity-1", event: "view", source },
  });
});
