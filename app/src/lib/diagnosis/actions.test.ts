import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiagnosisMode } from "@/lib/personality/types";
import { getQuestionsForMode } from "@/lib/personality/constants";

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
const mockPrismaPersonalityTypeFindUnique = vi.fn();
const mockPrismaDiagnosisResultCreate = vi.fn();
const mockPrismaTransaction = vi.fn();

const mockTransactionClient = {
  participantProfile: {
    update: (...args: unknown[]) => mockPrismaParticipantUpdate(...args),
  },
  personalityType: {
    findUnique: (...args: unknown[]) => mockPrismaPersonalityTypeFindUnique(...args),
  },
  diagnosisResult: {
    create: (...args: unknown[]) => mockPrismaDiagnosisResultCreate(...args),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    participantProfile: {
      findUnique: (...args: unknown[]) => mockPrismaParticipantFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaParticipantUpdate(...args),
    },
    personalityType: {
      findUnique: (...args: unknown[]) => mockPrismaPersonalityTypeFindUnique(...args),
    },
    diagnosisResult: {
      create: (...args: unknown[]) => mockPrismaDiagnosisResultCreate(...args),
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

// submitDiagnosis テスト用のダミー回答データ
function createMockAnswers(mode: DiagnosisMode = "brief") {
  return getQuestionsForMode(mode).map((question) => ({
    questionId: question.id,
    value: 3,
    timestamp: new Date().toISOString(),
  }));
}

describe("submitDiagnosis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaTransaction.mockImplementation(async (callback) =>
      callback(mockTransactionClient)
    );
    mockPrismaPersonalityTypeFindUnique.mockResolvedValue({
      id: "personality-type-uuid",
    });
    mockPrismaParticipantUpdate.mockResolvedValue({});
    mockPrismaDiagnosisResultCreate.mockResolvedValue({});
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await submitDiagnosis(createMockAnswers(), "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("参加者レコードが存在しない場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue(null);

    const result = await submitDiagnosis(createMockAnswers(), "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加者登録が必要です");
  });

  it("正常に診断結果を保存できる場合、success: true を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "user-123" });

    const result = await submitDiagnosis(createMockAnswers(), "brief");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(mockPrismaPersonalityTypeFindUnique).toHaveBeenCalledWith({
      where: { typeId: "supporter-care" },
      select: { id: true },
    });
    expect(mockPrismaParticipantUpdate).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: {
        diagnosisType: "supporter-care",
        diagnosisScores: {
          extraversion: 50,
          agreeableness: 50,
          conscientiousness: 50,
          neuroticism: 50,
          openness: 50,
        },
        diagnosisMode: "brief",
      },
    });
    expect(mockPrismaDiagnosisResultCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        personalityTypeId: "personality-type-uuid",
        big5Scores: {
          extraversion: 50,
          agreeableness: 50,
          conscientiousness: 50,
          neuroticism: 50,
          openness: 50,
        },
        diagnosisMode: "brief",
        closestTypeDistance: expect.any(Number),
      },
    });
  });

  it("詳細診断を正常に保存できる場合、diagnosisMode: full を保存する", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "user-123" });

    const result = await submitDiagnosis(createMockAnswers("full"), "full");

    expect(result.success).toBe(true);
    expect(mockPrismaParticipantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diagnosisMode: "full" }),
      })
    );
    expect(mockPrismaDiagnosisResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diagnosisMode: "full" }),
      })
    );
  });

  it("人物タイプマスタに対応レコードがない場合、personalityTypeId: null で保存する", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "user-123" });
    mockPrismaPersonalityTypeFindUnique.mockResolvedValue(null);

    const result = await submitDiagnosis(createMockAnswers(), "brief");

    expect(result.success).toBe(true);
    expect(mockPrismaDiagnosisResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personalityTypeId: null,
        }),
      })
    );
  });

  it("DB トランザクション中に更新エラーが発生した場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "user-123" });
    mockPrismaParticipantUpdate.mockRejectedValue(new Error("Update failed"));

    const result = await submitDiagnosis(createMockAnswers(), "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });

  it("診断履歴の作成に失敗した場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "user-123" });
    mockPrismaDiagnosisResultCreate.mockRejectedValue(new Error("Create failed"));

    const result = await submitDiagnosis(createMockAnswers(), "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });

  it("回答数が不足している場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const result = await submitDiagnosis(createMockAnswers().slice(0, 15), "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("すべての質問に回答してください");
    expect(mockPrismaParticipantFindUnique).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("詳細診断の回答数が不足している場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const result = await submitDiagnosis(createMockAnswers("full").slice(0, 59), "full");

    expect(result.success).toBe(false);
    expect(result.error).toBe("すべての質問に回答してください");
    expect(mockPrismaParticipantFindUnique).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("別モードの質問IDが混在している場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const answers = createMockAnswers();
    answers[0] = { ...answers[0], questionId: getQuestionsForMode("full")[0].id };

    const result = await submitDiagnosis(answers, "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("回答データが不正です");
    expect(mockPrismaParticipantFindUnique).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("重複した質問IDがある場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const answers = createMockAnswers();
    answers[1] = { ...answers[1], questionId: answers[0].questionId };

    const result = await submitDiagnosis(answers, "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("回答データが不正です");
    expect(mockPrismaParticipantFindUnique).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("不明な質問IDがある場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const answers = createMockAnswers();
    answers[0] = { ...answers[0], questionId: "unknown" };

    const result = await submitDiagnosis(answers, "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("回答データが不正です");
    expect(mockPrismaParticipantFindUnique).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("回答値が範囲外の場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const answers = createMockAnswers();
    answers[0] = { ...answers[0], value: 6 };

    const result = await submitDiagnosis(answers, "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("回答データが不正です");
    expect(mockPrismaParticipantFindUnique).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("予期しない例外が発生した場合、エラーを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const result = await submitDiagnosis(createMockAnswers(), "brief");

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});
