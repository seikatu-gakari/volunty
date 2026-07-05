import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IPIP_BFM_50_JA,
  IPIP_BFM_50_JA_BRIEF15,
  SCORING_ALGORITHM_VERSION,
} from "@/lib/diagnosis-scale/scale";
import { STYLE_TYPE_VERSION } from "@/lib/diagnosis-scale/style-types";
import { QUALITY_RULE_VERSION } from "@/lib/diagnosis-scale/quality";
import type { DiagnosisAnswer } from "@/lib/diagnosis-scale/types";

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
const mockPrismaDiagnosisResultCreate = vi.fn();
const mockPrismaDiagnosisResponseCreateMany = vi.fn();
const mockPrismaTransaction = vi.fn();

const mockTransactionClient = {
  participantProfile: {
    update: (...args: unknown[]) => mockPrismaParticipantUpdate(...args),
  },
  diagnosisResult: {
    create: (...args: unknown[]) => mockPrismaDiagnosisResultCreate(...args),
  },
  diagnosisResponse: {
    createMany: (...args: unknown[]) => mockPrismaDiagnosisResponseCreateMany(...args),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    participantProfile: {
      findUnique: (...args: unknown[]) => mockPrismaParticipantFindUnique(...args),
      update: (...args: unknown[]) => mockPrismaParticipantUpdate(...args),
    },
    diagnosisResult: {
      create: (...args: unknown[]) => mockPrismaDiagnosisResultCreate(...args),
    },
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchDiagnosisResult, submitDiagnosis } = await import("./actions");

const SCALED = {
  extraversion: 70,
  agreeableness: 90,
  conscientiousness: 50,
  emotionalStability: 70,
  intellect: 50,
};
const RAW = {
  extraversion: 38,
  agreeableness: 46,
  conscientiousness: 30,
  emotionalStability: 38,
  intellect: 30,
};

function createMockAnswers(value = 3): DiagnosisAnswer[] {
  return IPIP_BFM_50_JA.items.map((item) => ({
    itemCode: item.itemCode,
    value,
    elapsedMs: 2000,
    changedCount: 0,
  }));
}

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

  it("最新診断結果がない場合、null を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      latestDiagnosisResult: null,
    });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("スコアが不正な場合、null を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      latestDiagnosisResult: {
        scaleCode: "ipip-bfm-50-ja",
        scaleVersion: "1.0.0",
        rawScores: RAW,
        scaledScores: { extraversion: 70 }, // 不完全
        styleTypeId: "supporter-care",
        qualityFlags: [],
        answeredAt: new Date("2026-07-04T00:00:00Z"),
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).toBeNull();
  });

  it("正常な結果を尺度情報・実施日・品質フラグ付きで返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      latestDiagnosisResult: {
        scaleCode: "ipip-bfm-50-ja",
        scaleVersion: "1.0.0",
        rawScores: RAW,
        scaledScores: SCALED,
        styleTypeId: "supporter-care",
        qualityFlags: ["too_fast"],
        answeredAt: new Date("2026-07-04T00:00:00Z"),
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).not.toBeNull();
    expect(result!.scaledScores).toEqual(SCALED);
    expect(result!.rawScores).toEqual(RAW);
    expect(result!.scaleCode).toBe("ipip-bfm-50-ja");
    expect(result!.scaleVersion).toBe("1.0.0");
    expect(result!.answeredAt).toBe("2026-07-04T00:00:00.000Z");
    expect(result!.qualityFlags).toEqual(["too_fast"]);
    expect(result!.styleType?.id).toBe("supporter-care");
    expect(result!.styleType?.name).toBe("サポーター・ケアタイプ");
  });

  it("styleTypeId が不明な場合、styleType は null になる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      latestDiagnosisResult: {
        scaleCode: "ipip-bfm-50-ja",
        scaleVersion: "1.0.0",
        rawScores: RAW,
        scaledScores: SCALED,
        styleTypeId: "unknown-type",
        qualityFlags: [],
        answeredAt: new Date("2026-07-04T00:00:00Z"),
      },
    });

    const result = await fetchDiagnosisResult();

    expect(result).not.toBeNull();
    expect(result!.styleType).toBeNull();
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
});

describe("submitDiagnosis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaTransaction.mockImplementation(async (callback) =>
      callback(mockTransactionClient)
    );
    mockPrismaParticipantUpdate.mockResolvedValue({});
    mockPrismaDiagnosisResultCreate.mockResolvedValue({ id: "result-id" });
    mockPrismaDiagnosisResponseCreateMany.mockResolvedValue({ count: 50 });
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await submitDiagnosis({
      answers: createMockAnswers(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("参加者レコードが存在しない場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue(null);

    const result = await submitDiagnosis({
      answers: createMockAnswers(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加者登録が必要です");
  });

  it("正常保存: バージョン・品質フラグ・参考タイプ付きで保存し、最新参照を更新する", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "profile-id" });

    const result = await submitDiagnosis({
      answers: createMockAnswers(3),
      totalDurationMs: 200_000,
      resumedCount: 1,
    });

    expect(result).toEqual({ success: true });
    expect(mockPrismaDiagnosisResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-123",
          scaleCode: "ipip-bfm-50-ja",
          scaleVersion: IPIP_BFM_50_JA.scaleVersion,
          scoringAlgorithmVersion: SCORING_ALGORITHM_VERSION,
          normsVersion: null,
          styleTypeVersion: STYLE_TYPE_VERSION,
          qualityRuleVersion: QUALITY_RULE_VERSION,
          // 全問3: 全ドメイン raw 30 / scaled 50
          rawScores: {
            extraversion: 30,
            agreeableness: 30,
            conscientiousness: 30,
            emotionalStability: 30,
            intellect: 30,
          },
          // 全問同一選択肢のため straight_lining が付く
          qualityFlags: expect.arrayContaining(["straight_lining"]),
          totalDurationMs: 200_000,
          resumedCount: 1,
          styleTypeId: expect.any(String),
        }),
      })
    );
    expect(mockPrismaDiagnosisResponseCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            diagnosisResultId: "result-id",
            itemCode: IPIP_BFM_50_JA.items[0].itemCode,
            value: 3,
          }),
        ]),
      })
    );
    expect(mockPrismaParticipantUpdate).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { latestDiagnosisResultId: "result-id" },
    });
  });

  it("生回答は常に t_diagnosis_response へ保存する", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "profile-id" });

    const result = await submitDiagnosis({
      answers: createMockAnswers(),
    });

    expect(result.success).toBe(true);
    expect(mockPrismaDiagnosisResultCreate).toHaveBeenCalledTimes(1);
    expect(mockPrismaDiagnosisResponseCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            diagnosisResultId: "result-id",
            itemCode: IPIP_BFM_50_JA.items[0].itemCode,
          }),
        ]),
      })
    );
  });

  it("回答数が不足している場合、保存せず日本語エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const result = await submitDiagnosis({
      answers: createMockAnswers().slice(0, 49),
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/未回答/);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("不明な質問IDがある場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const answers = createMockAnswers();
    answers[0] = { ...answers[0], itemCode: "unknown" };

    const result = await submitDiagnosis({
      answers,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/質問が見つかりません/);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("回答値が範囲外の場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const answers = createMockAnswers();
    answers[0] = { ...answers[0], value: 6 };

    const result = await submitDiagnosis({
      answers,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/回答値が不正/);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("重複回答がある場合、保存せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const answers = createMockAnswers();
    answers[1] = { ...answers[0] };

    const result = await submitDiagnosis({
      answers,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/重複/);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("DB トランザクション中にエラーが発生した場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "profile-id" });
    mockPrismaDiagnosisResultCreate.mockRejectedValue(new Error("Create failed"));

    const result = await submitDiagnosis({
      answers: createMockAnswers(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });

  it("予期しない例外が発生した場合、エラーを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const result = await submitDiagnosis({
      answers: createMockAnswers(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });

  it("mode: 'brief' の場合、簡易版15項目で採点し scaleCode が簡易版になる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({ id: "profile-id" });

    const briefAnswers: DiagnosisAnswer[] = IPIP_BFM_50_JA_BRIEF15.items.map((item) => ({
      itemCode: item.itemCode,
      value: 3,
    }));

    const result = await submitDiagnosis({
      answers: briefAnswers,
      mode: "brief",
    });

    expect(result).toEqual({ success: true });
    expect(mockPrismaDiagnosisResultCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scaleCode: "ipip-bfm-50-ja-brief15",
          scaleVersion: IPIP_BFM_50_JA_BRIEF15.scaleVersion,
          rawScores: {
            extraversion: 9,
            agreeableness: 9,
            conscientiousness: 9,
            emotionalStability: 9,
            intellect: 9,
          },
        }),
      })
    );
  });

  it("mode: 'brief' で50項目分の回答を渡すと不明な質問としてエラーになる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const result = await submitDiagnosis({
      answers: createMockAnswers(),
      mode: "brief",
    });

    expect(result.success).toBe(false);
  });
});
