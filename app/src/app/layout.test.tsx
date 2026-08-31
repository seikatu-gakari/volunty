import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SpeedInsights } from "@vercel/speed-insights/react";

vi.mock("@/app/components/ui/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock(
  "@vercel/speed-insights/react",
  () => ({
    SpeedInsights: () => <div data-testid="speed-insights" />,
  }),
);

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("ToastProvider内で既存のchildrenの後にSpeedInsightsを1回だけ描画する", () => {
    const existingContent = <main data-testid="existing-content">既存の画面</main>;
    const layout = RootLayout({ children: existingContent });
    const body = layout.props.children;
    const provider = body.props.children;
    const providerChildren = provider.props.children as ReactNode[];

    expect(providerChildren).toHaveLength(2);
    expect(providerChildren[0]).toBe(existingContent);
    expect(providerChildren[1]).toMatchObject({ type: SpeedInsights, props: {} });
  });
});
