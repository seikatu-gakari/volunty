import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsRetryButton from "./AnalyticsRetryButton";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

describe("AnalyticsRetryButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("再試行ボタンはrouter.refreshを1回だけ呼び出す", () => {
    render(
      <AnalyticsRetryButton isSuccessful={false} headingId="analytics-heading" />,
    );

    const button = screen.getByRole("button", { name: "分析を再試行" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(button.parentElement?.getAttribute("aria-live")).toBe("polite");
  });

  it("再試行後に成功へ切り替わったときだけ分析見出しへフォーカスする", async () => {
    const { rerender } = render(
      <>
        <h2 id="analytics-heading" tabIndex={-1}>
          分析
        </h2>
        <AnalyticsRetryButton isSuccessful={false} headingId="analytics-heading" />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "分析を再試行" }));
    rerender(
      <>
        <h2 id="analytics-heading" tabIndex={-1}>
          分析
        </h2>
        <AnalyticsRetryButton isSuccessful headingId="analytics-heading" />
      </>,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(
        document.getElementById("analytics-heading"),
      );
    });
    expect(screen.queryByRole("button", { name: "分析を再試行" })).toBeNull();
  });

  it("初回成功時はフォーカスを移動しない", () => {
    render(
      <>
        <button type="button">別の操作</button>
        <h2 id="analytics-heading" tabIndex={-1}>
          分析
        </h2>
        <AnalyticsRetryButton isSuccessful headingId="analytics-heading" />
      </>,
    );

    expect(document.activeElement).not.toBe(
      document.getElementById("analytics-heading"),
    );
  });
});
