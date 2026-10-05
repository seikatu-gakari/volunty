import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchDiagnosisResult: vi.fn(),
  getUser: vi.fn(),
  getViewerContext: vi.fn(),
  header: vi.fn(),
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

vi.mock("@/lib/diagnosis/queries", () => ({
  fetchDiagnosisResultQuery: (...args: unknown[]) =>
    mocks.fetchDiagnosisResult(...args),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: () => mocks.getViewerContext(),
}));

vi.mock("@/app/components/Header", () => ({
  Header: ({ viewerContext }: { viewerContext?: unknown }) => {
    mocks.header(viewerContext);
    return <header>ヘッダー</header>;
  },
}));

import DiagnosisResultPage from "./page";
import { classifyActivityStyle } from "@/lib/diagnosis-scale/activity-styles";
import { ACTIVITY_STYLE_TYPES } from "@/lib/diagnosis-scale/style-types";

afterEach(cleanup);

describe("DiagnosisResultPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      identity: { id: "user-1", email: "user@example.com", displayName: "利用者" },
      role: "participant",
      isActive: true,
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
      organizationVerified: false,
      organizationReviewStatus: null,
    });
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
    expect(mocks.fetchDiagnosisResult).toHaveBeenCalledWith("user-1");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("本診断のキャラクターと既存のスコア・詳細・尺度情報を表示する", async () => {
    const result = await mocks.fetchDiagnosisResult();
    mocks.fetchDiagnosisResult.mockResolvedValue({
      ...result,
      styleType: ACTIVITY_STYLE_TYPES[0],
      scaleCode: "ipip-bfm-50-ja",
    });
    const { container } = render(await DiagnosisResultPage());
    expect(screen.getByRole("heading", { name: "ひらめきキツネ" })).toBeDefined();
    expect(screen.getByText("イノベーター・リーダータイプ")).toBeDefined();
    expect(screen.getByText("あなたに近い活動スタイル（参考）")).toBeDefined();
    expect(screen.getByText("5つの性格特性スコア")).toBeDefined();
    expect(screen.getByText(/性格傾向チェック（全50問）による診断/)).toBeDefined();
    expect(screen.getByText("発揮しやすい傾向の例")).toBeDefined();
    expect(screen.getByText("力を発揮しやすい活動の例")).toBeDefined();
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("新分類の3方向混合と実測5軸を表示し、動物に戻さない", async () => {
    const result = await mocks.fetchDiagnosisResult();
    const scores = { extraversion: 90, agreeableness: 90, conscientiousness: 10, emotionalStability: 50, intellect: 50 };
    const style = classifyActivityStyle(scores);
    mocks.fetchDiagnosisResult.mockResolvedValue({ ...result, scaledScores: scores, styleType: style, scaleCode: "ipip-bfm-50-ja-brief15" });
    const { container } = render(await DiagnosisResultPage());
    expect(screen.getByRole("heading", { name: style.name })).toBeDefined();
    expect(screen.getByRole("list", { name: "近い方向の一覧" }).children).toHaveLength(3);
    expect(screen.getByRole("meter", { name: "誠実性" }).getAttribute("aria-valuenow")).toBe("10");
    expect(screen.getByText(/分類の境界は暫定的/)).toBeDefined();
    expect(screen.getByText(/簡易診断（15問）は全50問版から項目を抜粋/)).toBeDefined();
    expect(screen.queryByText("力を発揮しやすい活動の例")).toBeNull();
    expect(screen.queryByText("発揮しやすい傾向の例")).toBeNull();
    expect(screen.getByRole("heading", { name: "今回の回答で近い方向" })).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });

  it("中立結果には方向一覧や活動適性の空カードを出さない", async () => {
    const result = await mocks.fetchDiagnosisResult();
    const scores = { extraversion: 50, agreeableness: 50, conscientiousness: 50, emotionalStability: 50, intellect: 50 };
    const style = classifyActivityStyle(scores);
    mocks.fetchDiagnosisResult.mockResolvedValue({ ...result, scaledScores: scores, styleType: style });
    render(await DiagnosisResultPage());
    expect(screen.getByRole("heading", { name: style.name })).toBeDefined();
    expect(screen.getAllByRole("meter")).toHaveLength(5);
    expect(screen.queryByText("力を発揮しやすい活動の例")).toBeNull();
    expect(screen.queryByText("発揮しやすい傾向の例")).toBeNull();
    expect(screen.queryByRole("heading", { name: "今回の回答で近い方向" })).toBeNull();
  });

});
