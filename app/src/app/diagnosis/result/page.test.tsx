import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchDiagnosisResult: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mocks.getUser() },
  }),
}));

vi.mock("@/lib/diagnosis/actions", () => ({
  fetchDiagnosisResult: () => mocks.fetchDiagnosisResult(),
}));

vi.mock("@/app/components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

import DiagnosisResultPage from "./page";

describe("DiagnosisResultPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.fetchDiagnosisResult.mockResolvedValue({
      scaledScores: {
        extraversion: 65,
        agreeableness: 70,
        conscientiousness: 75,
        emotionalStability: 65,
        intellect: 80,
      },
      rawScores: {
        extraversion: 36,
        agreeableness: 38,
        conscientiousness: 40,
        emotionalStability: 36,
        intellect: 42,
      },
      scaleCode: "legacy-big5",
      scaleVersion: "legacy",
      answeredAt: "2026-06-19T00:24:00.000Z",
      qualityFlags: [],
      styleType: null,
    });
  });

  it("旧診断を現行の全50問版と誤表示しない", async () => {
    render(await DiagnosisResultPage());

    expect(screen.getByText(/旧版の性格診断による診断/)).toBeDefined();
    expect(screen.queryByText(/性格傾向チェック（全50問）による診断/)).toBeNull();
  });
});
