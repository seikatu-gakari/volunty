import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpportunityForm } from "./OpportunityForm";

const NOW = new Date("2026-09-06T00:00:30.000Z");
const SCHEDULED_ERROR = "公開予約日時は現在より後の日時を指定してください";

describe("OpportunityForm の公開予約", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("JSTの説明、分単位の入力、現在より後の分をminに設定する", async () => {
    const onSubmitAction = vi.fn().mockResolvedValue({ success: true });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "公開予約" }));
    const input = screen.getByLabelText(/公開日時（日本時間）/);
    expect(input.getAttribute("type")).toBe("datetime-local");
    expect(input.getAttribute("step")).toBe("60");
    expect(input.getAttribute("min")).toBe("2026-09-06T09:01");
    expect(
      screen.getByText(
        "日本時間（UTC+09:00）で指定してください。指定した時刻以降に公開されます。",
      ),
    ).toBeDefined();
    expect(input.getAttribute("aria-describedby")).toBe("publishedAt-help");
  });

  it("サーバーの予約エラーを入力直下に表示し、入力値とフォーカスを維持する", async () => {
    vi.useRealTimers();
    const onSubmitAction = vi.fn().mockResolvedValue({
      success: false,
      error: SCHEDULED_ERROR,
      fieldErrors: { publishedAt: SCHEDULED_ERROR },
    });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "公開予約" }));

    const input = screen.getByLabelText(
      /公開日時（日本時間）/,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-09-06T09:00" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmitAction).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText(SCHEDULED_ERROR)).toHaveLength(2);
    });

    const submittedData = onSubmitAction.mock.calls[0]?.[0] as FormData;
    expect(submittedData.get("publishedAt")).toBe("2026-09-06T09:00");
    expect(input.value).toBe("2026-09-06T09:00");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      "publishedAt-help publishedAt-error",
    );
    expect(document.activeElement).toBe(input);
  });

  it("公開方法を変更すると予約エラーを解除する", async () => {
    vi.useRealTimers();
    const onSubmitAction = vi.fn().mockResolvedValue({
      success: false,
      error: SCHEDULED_ERROR,
      fieldErrors: { publishedAt: SCHEDULED_ERROR },
    });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "公開予約" }));
    const input = screen.getByLabelText(/公開日時（日本時間）/);
    fireEvent.change(input, { target: { value: "2026-09-06T09:00" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await screen.findAllByText(SCHEDULED_ERROR);
    fireEvent.click(screen.getByRole("radio", { name: "下書き保存" }));

    expect(screen.queryByText(SCHEDULED_ERROR)).toBeNull();
    expect(screen.queryByLabelText(/公開日時（日本時間）/)).toBeNull();
  });

  it("入力へフォーカスした時点の次のJST分へminを更新する", () => {
    const onSubmitAction = vi.fn().mockResolvedValue({ success: true });

    render(
      <OpportunityForm
        onSubmitAction={onSubmitAction}
        cancelHref="/dashboard"
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "公開予約" }));
    const input = screen.getByLabelText(/公開日時（日本時間）/);

    vi.setSystemTime(new Date("2026-09-06T00:01:30.000Z"));
    fireEvent.focus(input);

    expect(input.getAttribute("min")).toBe("2026-09-06T09:02");
  });
});
