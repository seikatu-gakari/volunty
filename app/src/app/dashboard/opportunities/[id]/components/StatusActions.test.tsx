import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatusActions } from "./StatusActions";

const refresh = vi.fn();
const updateApplicationStatus = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/dashboard/actions", () => ({
  updateApplicationStatus: (...args: unknown[]) =>
    updateApplicationStatus(...args),
}));

describe("StatusActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("承認成功後にServer Componentの応募者詳細を再取得する", async () => {
    updateApplicationStatus.mockResolvedValue({ success: true });
    render(
      <StatusActions applicationId="application-1" currentStatus="pending" />
    );

    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(updateApplicationStatus).toHaveBeenCalledWith(
      "application-1",
      "approved"
    );
  });

  it("更新失敗時は再取得せずエラーを表示する", async () => {
    updateApplicationStatus.mockResolvedValue({
      success: false,
      error: "更新できませんでした",
    });
    render(
      <StatusActions applicationId="application-1" currentStatus="pending" />
    );

    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(await screen.findByText("更新できませんでした")).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });
});
