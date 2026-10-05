import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPBottomCTA } from "@/app/components/lp/LPBottomCTA";

describe("LPBottomCTA", () => {
  it("アンカーで移動できる事前登録セクションと利用目的を表示する", () => {
    render(<LPBottomCTA />);

    expect(screen.getByRole("region", { name: /サービス開始を、\s*メールでお知らせ。/ }).id).toBe("waitlist");
    expect(screen.getByText("ただいま公開準備中")).toBeDefined();
    expect(screen.getByRole("form", { name: "開始通知の事前登録" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "メールアドレスの利用目的" }).parentElement?.id).toBe("waitlist-privacy");
    expect(screen.getByText(/この登録で会員アカウントは作成されません/)).toBeDefined();
  });
});
