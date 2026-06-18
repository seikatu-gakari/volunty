import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApproveCertificate = vi.fn();
const mockRejectCertificate = vi.fn();

vi.mock("@/lib/certificates/actions", () => ({
  approveCertificate: (...args: unknown[]) => mockApproveCertificate(...args),
  rejectCertificate: (...args: unknown[]) => mockRejectCertificate(...args),
}));

const { CertificateReviewActions } = await import("./CertificateReviewActions");

describe("CertificateReviewActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApproveCertificate.mockResolvedValue({
      success: true,
      certificateId: "certificate-1",
    });
    mockRejectCertificate.mockResolvedValue({
      success: true,
      certificateId: "certificate-1",
    });
  });

  it("証明書申請を承認して発行済みにできる", async () => {
    render(<CertificateReviewActions certificateId="certificate-1" />);

    fireEvent.click(screen.getByRole("button", { name: "承認して発行する" }));

    await waitFor(() => {
      expect(mockApproveCertificate).toHaveBeenCalledWith("certificate-1");
    });
    expect(screen.getByText("証明書を発行しました")).toBeDefined();
  });

  it("理由付きで証明書申請を却下できる", async () => {
    render(<CertificateReviewActions certificateId="certificate-1" />);

    fireEvent.change(screen.getByLabelText("却下理由"), {
      target: { value: "参加実績を確認できませんでした" },
    });
    fireEvent.click(screen.getByRole("button", { name: "却下する" }));

    await waitFor(() => {
      expect(mockRejectCertificate).toHaveBeenCalledWith(
        "certificate-1",
        "参加実績を確認できませんでした"
      );
    });
    expect(screen.getByText("申請を却下しました")).toBeDefined();
  });
});
