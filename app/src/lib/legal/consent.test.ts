import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    legalConsent: {
      upsert: mockUpsert,
    },
  },
}));

const { recordLegalConsent } = await import("./consent");

describe("recordLegalConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ id: "consent-1" });
  });

  it("ユーザーと文書版を保存し、同じ版の再送をupsertで冪等に扱う", async () => {
    const agreedAt = new Date("2026-09-07T00:00:00.000Z");

    await recordLegalConsent({
      userId: "user-1",
      termsVersion: "2026-09-07",
      privacyVersion: "2026-09-07",
      agreedAt,
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: {
        userId_termsVersion_privacyVersion: {
          userId: "user-1",
          termsVersion: "2026-09-07",
          privacyVersion: "2026-09-07",
        },
      },
      create: {
        userId: "user-1",
        termsVersion: "2026-09-07",
        privacyVersion: "2026-09-07",
        agreedAt,
      },
      update: {},
    });
  });

  it("版が変わった場合は新しい複合キーで保存する", async () => {
    await recordLegalConsent({
      userId: "user-1",
      termsVersion: "2026-09-08",
      privacyVersion: "2026-09-08",
      agreedAt: new Date("2026-09-08T00:00:00.000Z"),
    });

    expect(mockUpsert.mock.calls[0][0].where).toEqual({
      userId_termsVersion_privacyVersion: {
        userId: "user-1",
        termsVersion: "2026-09-08",
        privacyVersion: "2026-09-08",
      },
    });
  });
});
