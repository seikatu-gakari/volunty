import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantProfileForm } from "./ParticipantProfileForm";

const registerParticipant = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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

  const requiredFields = [
    {
      field: "name",
      label: "表示名",
      error: "表示名を入力してください",
      errorId: "participant-name-error",
    },
    {
      field: "birthYear",
      label: "年",
      error: "生年を選択してください",
      errorId: "participant-birth-year-error",
    },
    {
      field: "birthMonth",
      label: "月",
      error: "生月を選択してください",
      errorId: "participant-birth-month-error",
    },
    {
      field: "birthDay",
      label: "日",
      error: "生日を選択してください",
      errorId: "participant-birth-day-error",
    },
    {
      field: "region",
      label: "都道府県",
      error: "都道府県を選択してください",
      errorId: "participant-region-error",
    },
  ] as const;

  function getForm(): HTMLFormElement {
    const form = screen.getByRole("button", {
      name: /登録して診断へ進む|更新する/,
    }).closest("form");
    if (!form) throw new Error("フォームが見つかりません");
    return form;
  }

  function fillRequiredFieldsExcept(field: string) {
    if (field !== "name") {
      fireEvent.change(screen.getByLabelText("表示名"), {
        target: { value: "山田 太郎" },
      });
    }
    if (field !== "birthYear") {
      fireEvent.change(screen.getByLabelText("年"), {
        target: { value: "2000" },
      });
    }
    if (field !== "birthMonth") {
      fireEvent.change(screen.getByLabelText("月"), {
        target: { value: "1" },
      });
    }
    if (field !== "birthDay") {
      fireEvent.change(screen.getByLabelText("日"), {
        target: { value: "1" },
      });
    }
    if (field !== "region") {
      fireEvent.change(screen.getByLabelText("都道府県"), {
        target: { value: "東京都" },
      });
    }
  }

  it.each(requiredFields)(
    "$labelの必須エラーを入力欄へ関連付け、保存を抑止する",
    ({ field, label, error, errorId }) => {
      render(<ParticipantProfileForm />);
      fillRequiredFieldsExcept(field);

      const input = screen.getByLabelText(label);
      const form = getForm();
      fireEvent.invalid(input);
      fireEvent.submit(form);

      expect(registerParticipant).not.toHaveBeenCalled();
      expect(input.getAttribute("required")).toBe("");
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toContain(errorId);
      expect(document.getElementById(errorId)?.textContent).toBe(error);
    }
  );

  it("複数の必須エラーではDOM順の最初へ一度だけフォーカスし、ヘッダー下へスクロールする", async () => {
    render(<ParticipantProfileForm />);

    const header = document.createElement("header");
    document.body.appendChild(header);
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 78,
      left: 0,
      right: 390,
      width: 390,
      height: 78,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const name = screen.getByLabelText("表示名");
    const fieldWrapper = name.closest<HTMLElement>("[data-participant-field]");
    if (!fieldWrapper) throw new Error("フィールドwrapperが見つかりません");
    vi.spyOn(fieldWrapper, "getBoundingClientRect").mockReturnValue({
      top: 200,
      bottom: 260,
      left: 0,
      right: 390,
      width: 390,
      height: 60,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 100,
    });

    fireEvent.invalid(name);

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    expect(document.activeElement).toBe(name);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 206,
      behavior: "auto",
    });
  });

  it("不完全な生年月日は保存せず、修正後は既存payloadで進める", () => {
    render(<ParticipantProfileForm />);
    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "山田 太郎" },
    });
    fireEvent.change(screen.getByLabelText("年"), {
      target: { value: "2025" },
    });
    fireEvent.change(screen.getByLabelText("月"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("日"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("都道府県"), {
      target: { value: "東京都" },
    });

    fireEvent.submit(getForm());

    expect(registerParticipant).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "有効な生年月日を入力してください（未来の日付や存在しない日付は無効です）"
      )
    ).toBeDefined();
    for (const label of ["年", "月", "日"]) {
      const field = screen.getByLabelText(label);
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(field.getAttribute("aria-describedby")).toContain(
        "participant-birthday-error"
      );
    }

    fireEvent.change(screen.getByLabelText("日"), {
      target: { value: "28" },
    });
    expect(
      screen.queryByText(
        "有効な生年月日を入力してください（未来の日付や存在しない日付は無効です）"
      )
    ).toBeNull();
    fireEvent.submit(getForm());

    expect(registerParticipant).toHaveBeenCalledWith({
      name: "山田 太郎",
      birthday: "2025-02-28",
      gender: undefined,
      region: "東京都",
      bio: undefined,
      lineId: undefined,
      interests: undefined,
    });
  });
});
