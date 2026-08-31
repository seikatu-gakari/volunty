import { describe, expect, it } from "vitest";

import {
  parseForwardedViewerContext,
  serializeForwardedViewerContext,
} from "./viewer-context-header";

const forwardedViewer = {
  identity: {
    id: "participant-1",
    email: "participant@example.com",
    displayName: "参加者 太郎",
  },
  role: "participant" as const,
  isActive: true,
  hasParticipantProfile: true,
  hasOrganizationProfile: false,
  organizationVerified: false,
  organizationReviewStatus: null,
};

describe("viewer context request header", () => {
  it("Proxyで検証済みの最小コンテキストを可逆に転送する", () => {
    const encoded = serializeForwardedViewerContext(forwardedViewer);

    expect(parseForwardedViewerContext(encoded)).toEqual(forwardedViewer);
  });

  it.each([
    null,
    "",
    "not-json",
    encodeURIComponent(JSON.stringify({ version: 2, ...forwardedViewer })),
    encodeURIComponent(
      JSON.stringify({ version: 1, ...forwardedViewer, role: "owner" }),
    ),
    encodeURIComponent(
      JSON.stringify({ version: 1, ...forwardedViewer, isActive: "true" }),
    ),
  ])("不正な内部ヘッダーは受理しない", (value) => {
    expect(parseForwardedViewerContext(value)).toBeNull();
  });
});
