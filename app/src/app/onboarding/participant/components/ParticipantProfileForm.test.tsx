import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantProfileForm } from "./ParticipantProfileForm";

const registerParticipant = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/onboarding/actions", () => ({
  registerParticipant: (...args: unknown[]) => registerParticipant(...args),
}));

describe("ParticipantProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerParticipant.mockResolvedValue({ success: true });
  });

  it("LINE IDの共有条件を入力欄の近くに表示する", () => {
    render(<ParticipantProfileForm />);

    expect(screen.getByLabelText("LINE ID（任意）")).toBeDefined();
    expect(
      screen.getByText(
        "LINE IDは、応募した団体とのマッチングが成立した場合にのみ、その団体へ共有されます。マッチング成立前や他の団体には公開されません。"
      )
    ).toBeDefined();
  });

  it("入力したLINE IDを参加者登録処理へ渡す", async () => {
    render(<ParticipantProfileForm />);

    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "山田 太郎" },
    });
    fireEvent.change(screen.getByLabelText("年"), { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText("月"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("日"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("都道府県"), {
      target: { value: "東京都" },
    });
    fireEvent.change(screen.getByLabelText("LINE ID（任意）"), {
      target: { value: " participant-line-id " },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録して診断へ進む" }));

    expect(registerParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ lineId: " participant-line-id " })
    );
  });
});
