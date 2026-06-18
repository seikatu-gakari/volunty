import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { CertificatePdfData } from "./types";

const { generateCertificatePdf } = await import("./pdf");

const pdfData: CertificatePdfData = {
  certificateNumber: "VOL-20260618-0001",
  participantName: "山田 花子",
  organizationName: "NPO法人テスト",
  opportunityTitle: "地域清掃ボランティア",
  activityDateLabel: "2026年6月1日",
  issuedAtLabel: "2026年6月18日",
};

describe("generateCertificatePdf", () => {
  it("証明書PDFのバイト列を生成する", async () => {
    const bytes = await generateCertificatePdf(pdfData);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });
});
