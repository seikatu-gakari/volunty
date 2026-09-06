import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/ui/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@vercel/speed-insights/react", () => ({
  SpeedInsights: () => <div data-testid="speed-insights" />,
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("画面と性能計測コンポーネントを描画する", () => {
    const html = renderToStaticMarkup(<RootLayout><main>既存の画面</main></RootLayout>);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("main")?.textContent).toBe("既存の画面");
    expect(document.querySelectorAll('[data-testid="speed-insights"]')).toHaveLength(1);
  });
});
