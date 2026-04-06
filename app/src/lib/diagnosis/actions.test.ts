import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockSingle(),
        }),
      }),
    }),
  }),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchDiagnosisResult } = await import("./actions");

describe("fetchDiagnosisResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、null を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("参加者レコードが存在しない場合、null を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockSingle.mockReturnValue({ data: null });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("diagnosis_scores が不正な場合、null を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockSingle.mockReturnValue({
      data: {
        diagnosis_type: "innovator-leader",
        diagnosis_scores: { extraversion: 80 }, // 不完全（5特性揃っていない）
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("完全一致する人物タイプがある場合、isExactMatch: true を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockSingle.mockReturnValue({
      data: {
        diagnosis_type: "innovator-leader",
        diagnosis_scores: {
          extraversion: 85,
          agreeableness: 70,
          conscientiousness: 80,
          neuroticism: 40,
          openness: 90,
        },
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).not.toBeNull();
    expect(result!.isExactMatch).toBe(true);
    expect(result!.personalityType.id).toBe("innovator-leader");
    expect(result!.scores.extraversion).toBe(85);
  });

  it("diagnosis_type が不明な場合、近似一致のタイプを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockSingle.mockReturnValue({
      data: {
        diagnosis_type: "unknown-type",
        diagnosis_scores: {
          extraversion: 50,
          agreeableness: 50,
          conscientiousness: 50,
          neuroticism: 50,
          openness: 50,
        },
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).not.toBeNull();
    expect(result!.isExactMatch).toBe(false);
    expect(result!.personalityType).toBeDefined();
    expect(result!.scores.extraversion).toBe(50);
  });

  it("diagnosis_type が null の場合、近似一致のタイプを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockSingle.mockReturnValue({
      data: {
        diagnosis_type: null,
        diagnosis_scores: {
          extraversion: 80,
          agreeableness: 60,
          conscientiousness: 75,
          neuroticism: 30,
          openness: 85,
        },
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).not.toBeNull();
    expect(result!.isExactMatch).toBe(false);
    expect(result!.personalityType).toBeDefined();
  });

  it("Supabase 接続エラー時にクラッシュせず null を返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });
});
