import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequestCertificate = vi.fn();

vi.mock("@/lib/certificates/actions", () => ({
  requestCertificate: (...args: unknown[]) => mockRequestCertificate(...args),
}));

const { RequestCertificateForm } = await import("./RequestCertificateForm");

describe("RequestCertificateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestCertificate.mockResolvedValue({
      success: true,
      certificateId: "certificate-1",
    });
  });

  it("証明書申請を送信して詳細リンクを表示する", async () => {
    render(<RequestCertificateForm applicationId="application-1" />);

    fireEvent.click(screen.getByRole("button", { name: "証明書を申請する" }));

    await waitFor(() => {
      expect(mockRequestCertificate).toHaveBeenCalledWith("application-1");
    });
    expect(screen.getByText("証明書申請を送信しました")).toBeDefined();
    expect(screen.getByRole("link", { name: "申請状況を見る" }).getAttribute("href")).toBe(
      "/mypage/certificates/certificate-1"
    );
  });
});
