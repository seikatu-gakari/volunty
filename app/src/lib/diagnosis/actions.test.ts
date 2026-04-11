import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase クライアントのモック（認証のみ）
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

// Prisma のモック
const mockPrismaParticipantFindUnique = vi.fn();
const mockPrismaParticipantUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participantProfile: {
      findUnique: (...args: unknown[]) => mockPrismaParticipantFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaParticipantUpdate(...args),
    },
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchDiagnosisResult, submitDiagnosis } = await import("./actions");

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
    mockPrismaParticipantFindUnique.mockResolvedValue(null);

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("diagnosis_scores が不正な場合、null を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      diagnosisType: "innovator-leader",
      diagnosisScores: { extraversion: 80 }, // 不完全（5特性揃っていない）
    });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("完全一致する人物タイプがある場合、isExactMatch: true を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      diagnosisType: "innovator-leader",
      diagnosisScores: {
        extraversion: 85,
        agreeableness: 70,
        conscientiousness: 80,
        neuroticism: 40,
        openness: 90,
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).not.toBeNull();
    expect(result!.isExactMatch).toBe(true);
    expect(result!.personalityType.id).toBe("innovator-leader");
    expect(result!.personalityType.name).toBe("イノベーター・リーダータイプ");
    expect(result!.personalityType.nameEn).toBe("Innovator Leader");
    expect(result!.personalityType.description).toBeTruthy();
    expect(result!.personalityType.strengths.length).toBeGreaterThan(0);
    expect(result!.personalityType.suitableActivities.length).toBeGreaterThan(0);
    expect(result!.scores.extraversion).toBe(85);
  });

  it("DB クエリ中に例外が発生した場合、null を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockImplementation(() => {
      throw new Error("Database query error");
    });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("diagnosis_type が不明な場合、近似一致のタイプを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      diagnosisType: "unknown-type",
      diagnosisScores: {
        extraversion: 50,
        agreeableness: 50,
        conscientiousness: 50,
        neuroticism: 50,
        openness: 50,
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
    mockPrismaParticipantFindUnique.mockResolvedValue({
      diagnosisType: null,
      diagnosisScores: {
        extraversion: 80,
        agreeableness: 60,
        conscientiousness: 75,
        neuroticism: 30,
        openness: 85,
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

// submitDiagnosis テスト用のダミー回答データ（50問分）
function createMockAnswers() {
  const traits = ["e", "a", "c", "n", "o"];
  return traits.flatMap((prefix) =>
    Array.from({ length: 10 }, (_, i) => ({
      questionId: `${prefix}${i + 1}`,
      value: 3,
      timestamp: new Date().toISOString(),
    }))
  );
}

describe("submitDiagnosis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await submitDiagnosis(createMockAnswers());

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("参加者レコードが存在しない場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue(null);

    const result = await submitDiagnosis(createMockAnswers());

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加者登録が必要です");
  });

  it("正常に診断結果を保存できる場合、success: true を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "user-123" });
    mockPrismaParticipantUpdate.mockResolvedValue({});

    const result = await submitDiagnosis(createMockAnswers());

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("DB 更新エラーの場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "user-123" });
    mockPrismaParticipantUpdate.mockRejectedValue(new Error("Update failed"));

    const result = await submitDiagnosis(createMockAnswers());

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });

  it("予期しない例外が発生した場合、エラーを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const result = await submitDiagnosis(createMockAnswers());

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});
