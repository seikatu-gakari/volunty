import { describe, expect, it } from "vitest";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { getOpportunityActionMode } from "./detail-access";

const guest: ViewerContext = { status: "guest" };
const participant: ViewerContext = {
  status: "authenticated",
  identity: { id: "participant", email: null, displayName: null },
  role: "participant",
  isActive: true,
  hasParticipantProfile: true,
  hasOrganizationProfile: false,
  organizationVerified: false,
  organizationReviewStatus: null,
};
const organization: ViewerContext = {
  ...participant,
  identity: { id: "organization", email: null, displayName: null },
  role: "organization",
  hasParticipantProfile: false,
  hasOrganizationProfile: true,
};

describe("getOpportunityActionMode", () => {
  it("未認証にはログイン導線を表示する", () => {
    expect(getOpportunityActionMode(guest, false)).toBe("login-required");
  });

  it("参加者には応募・保存操作を表示する", () => {
    expect(getOpportunityActionMode(participant, true)).toBe("participant");
  });

  it("団体には参加者用の状態変更操作を表示しない", () => {
    expect(getOpportunityActionMode(organization, false)).toBe("read-only");
  });
});
