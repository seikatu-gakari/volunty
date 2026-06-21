import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineContactCard } from "@/app/components/LineContactCard";

describe("LineContactCard", () => {
  it("友だち追加URLがある場合、ボタン・QR・LINE IDを表示する", async () => {
    const element = await LineContactCard({
      addUrl: "https://line.me/R/ti/p/@volunty",
      displayId: "@volunty",
    });

    render(element);

    const link = screen.getByRole("link", { name: /友だち追加/ });
    expect(link.getAttribute("href")).toBe("https://line.me/R/ti/p/@volunty");
    expect(screen.getByLabelText("LINE友だち追加用QRコード")).toBeDefined();
    expect(screen.getByText("@volunty")).toBeDefined();
  });

  it("メールだけがある場合も団体連絡先として表示する", async () => {
    const element = await LineContactCard({
      addUrl: null,
      displayId: null,
      email: "contact@example.org",
    });

    render(element);

    expect(screen.getByText("団体連絡先")).toBeDefined();
    expect(screen.getByText("contact@example.org")).toBeDefined();
  });

  it("連絡先が無い場合は何も描画しない", async () => {
    const element = await LineContactCard({
      addUrl: null,
      displayId: null,
      email: null,
    });

    expect(element).toBeNull();
  });
});
