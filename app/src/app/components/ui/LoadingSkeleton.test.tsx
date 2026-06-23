import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageLoadingSkeleton, Skeleton } from "@/app/components/ui/LoadingSkeleton";

describe("LoadingSkeleton", () => {
  it("共通スケルトンが装飾要素として描画される", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);

    const skeleton = container.firstElementChild;
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton?.className).toContain("animate-pulse");
    expect(skeleton?.className).toContain("h-4 w-24");
  });

  it("リスト向けページローディングをステータスとして表示する", () => {
    render(
      <PageLoadingSkeleton title="おすすめ案件" variant="list" itemCount={2} />,
    );

    const status = screen.getByRole("status", {
      name: "おすすめ案件を読み込み中",
    });
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("読み込み中...")).toBeDefined();

    const list = within(status).getByRole("list", {
      name: "おすすめ案件の読み込み項目",
    });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("フォーム向けページローディングではフォーム枠を表示する", () => {
    render(<PageLoadingSkeleton title="プロフィール編集" variant="form" />);

    expect(
      screen.getByRole("group", {
        name: "プロフィール編集の入力項目を読み込み中",
      }),
    ).toBeDefined();
  });
});
