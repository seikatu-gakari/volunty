import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageLoadingSkeleton, Skeleton } from "@/app/components/ui/LoadingSkeleton";

describe("LoadingSkeleton", () => {
  it("共通スケルトンは読み上げ対象から外す", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each(["list", "dashboard", "form", "detail"] as const)(
    "%s向けの読み込み状態と内容を表示する",
    (variant) => {
      render(<PageLoadingSkeleton title="対象画面" variant={variant} itemCount={2} />);
      const status = screen.getByRole("status", { name: "対象画面を読み込み中" });
      expect(status.getAttribute("aria-busy")).toBe("true");
      expect(within(status).getByText("読み込み中...")).toBeDefined();

      if (variant === "list" || variant === "dashboard") {
        const list = within(status).getByRole("list", { name: "対象画面の読み込み項目" });
        expect(within(list).getAllByRole("listitem")).toHaveLength(2);
      } else if (variant === "form") {
        expect(within(status).getByRole("group", { name: "対象画面の入力項目を読み込み中" })).toBeDefined();
      } else {
        expect(within(status).getByLabelText("対象画面の詳細を読み込み中")).toBeDefined();
      }
    },
  );
});
