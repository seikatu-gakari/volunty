import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OpportunityDetailResult, ApplyResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

// チェーン可能なモックビルダー
function createChainMock() {
  return {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        eq: (...eqArgs: unknown[]) => {
          mockEq(...eqArgs);
          return {
            single: () => mockSingle(),
            eq: (...eqArgs2: unknown[]) => {
              mockEq(...eqArgs2);
              return {
                single: () => mockSingle(),
              };
            },
          };
        },
      };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return mockInsert();
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      return createChainMock();
    },
  }),
}));

// Prisma のモック（閲覧イベント記録・推薦ログ検証用）
const mockEngagementCreate = vi.fn().mockResolvedValue({});
const mockRecommendationLogFindFirst = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    engagementEvent: {
      create: (...args: unknown[]) => mockEngagementCreate(...args),
    },
    recommendationLog: {
      findFirst: (...args: unknown[]) => mockRecommendationLogFindFirst(...args),
    },
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchOpportunityDetail, applyToOpportunity } = await import(
  "./actions"
);

describe("fetchOpportunityDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、空のデータを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.existingApplication).toBeNull();
    expect(result.isParticipant).toBe(false);
  });

  it("案件が存在しない場合、opportunity が null を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // opportunities テーブルからの取得が null
    mockSingle.mockReturnValue({ data: null, error: { code: "PGRST116" } });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("nonexistent");

    expect(result.opportunity).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("m_opportunity");
  });

  it("案件が存在する場合、案件詳細を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // 案件データ
    const mockOpp = {
      id: "opp-1",
      title: "環境保全ボランティア",
      description: "森林保全活動です",
      activity_style_tags: ["talk-with-new-people"],
      required_qualifications: ["普通自動車免許"],
      min_age: 18,
      max_age: null,
      status: "published",
      created_at: "2026-01-01T00:00:00Z",
      location: "渋谷区",
      start_date: "2026-07-01T00:00:00.000Z",
      end_date: "2026-07-10",
      capacity: 10,
      current_applicants: 3,
      category: "環境保全",
      participation_mode: "offline",
      m_organization_profile: { id: "org-1", organization_name: "NPO法人テスト", description: "テスト団体です" },
    };

    // 参加者データ
    const mockParticipant = { id: "participant-1" };

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: mockOpp, error: null }; // m_opportunity
      if (callCount === 2) return { data: mockParticipant, error: null }; // m_participant_profile
      return { data: null, error: null }; // t_matching_candidate (応募なし)
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.opportunity).not.toBeNull();
    expect(result.opportunity?.title).toBe("環境保全ボランティア");
    expect(result.opportunity?.description).toBe("森林保全活動です");
    expect(result.opportunity?.organization.name).toBe("NPO法人テスト");
    expect(result.opportunity?.status).toBe("published");
    // 追加項目（日付は YYYY-MM-DD に正規化される）
    expect(result.opportunity?.location).toBe("渋谷区");
    expect(result.opportunity?.start_date).toBe("2026-07-01");
    expect(result.opportunity?.end_date).toBe("2026-07-10");
    expect(result.opportunity?.capacity).toBe(10);
    expect(result.opportunity?.current_applicants).toBe(3);
    expect(result.opportunity?.category).toBe("環境保全");
    expect(result.opportunity?.participation_mode).toBe("offline");
    // 活動スタイルタグはラベルへ変換される
    expect(result.opportunity?.activity_style_labels).toEqual([
      "初対面の人と多く話す",
    ]);
    expect(result.opportunity?.required_qualifications).toEqual([
      "普通自動車免許",
    ]);
    expect(result.opportunity?.min_age).toBe(18);
    expect(result.isParticipant).toBe(true);
    expect(result.existingApplication).toBeNull();
    // 参加者の閲覧はエンゲージメントイベントとして記録される
    expect(mockEngagementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-123",
          opportunityId: "opp-1",
          event: "view",
        }),
      })
    );
  });

  it("公開予約中の案件は参加者向け詳細として返さない", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    mockSingle.mockReturnValueOnce({
      data: {
        id: "opp-scheduled",
        title: "予約案件",
        description: "未来に公開",
        activity_style_tags: null,
        required_qualifications: null,
        min_age: null,
        max_age: null,
        status: "published",
        published_at: "2999-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00Z",
        location: null,
        start_date: null,
        end_date: null,
        capacity: null,
        current_applicants: 0,
        category: null,
        participation_mode: null,
        m_organization_profile: {
          id: "org-1",
          organization_name: "NPO法人テスト",
          description: null,
        },
      },
      error: null,
    });

    const result = await fetchOpportunityDetail("opp-scheduled");

    expect(result.opportunity).toBeNull();
    expect(mockEngagementCreate).not.toHaveBeenCalled();
  });

  it("応募済みの場合、existingApplication を含める", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const mockOpp = {
      id: "opp-1",
      title: "子ども支援活動",
      description: null,
      activity_style_tags: null,
      required_qualifications: null,
      min_age: null,
      max_age: null,
      status: "published",
      created_at: "2026-01-01T00:00:00Z",
      m_organization_profile: { id: "org-2", organization_name: "支援団体A", description: null },
    };

    const mockApp = {
      id: "app-1",
      status: "applied",
      message: "参加したいです",
      applied_at: "2026-01-15T00:00:00Z",
      status_changed_at: "2026-01-15T00:00:00Z",
    };

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: mockOpp, error: null }; // m_opportunity
      if (callCount === 2) return { data: null, error: null }; // m_participant_profile (非参加者)
      return { data: mockApp, error: null }; // t_matching_candidate
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.existingApplication).not.toBeNull();
    // DBステータス "applied" は UI では "pending" にマッピングされる
    expect(result.existingApplication?.status).toBe("pending");
    expect(result.existingApplication?.completed_at).toBeNull();
    expect(result.existingApplication?.message).toBe("参加したいです");
  });

  it("活動完了済みの場合、existingApplication に completed と完了日時を含める", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const mockOpp = {
      id: "opp-1",
      title: "子ども支援活動",
      description: null,
      activity_style_tags: null,
      required_qualifications: null,
      min_age: null,
      max_age: null,
      status: "published",
      created_at: "2026-01-01T00:00:00Z",
      m_organization_profile: {
        id: "org-2",
        organization_name: "支援団体A",
        description: null,
      },
    };

    const mockApp = {
      id: "app-1",
      status: "completed",
      message: "参加しました",
      applied_at: "2026-01-15T00:00:00Z",
      status_changed_at: "2026-02-01T10:00:00Z",
    };

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: mockOpp, error: null };
      if (callCount === 2) return { data: null, error: null };
      return { data: mockApp, error: null };
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.existingApplication?.status).toBe("completed");
    expect(result.existingApplication?.completed_at).toBe(
      "2026-02-01T10:00:00Z"
    );
  });

  it("予期しないエラー時もクラッシュせず空データを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.existingApplication).toBeNull();
    expect(result.isParticipant).toBe(false);
  });
});

describe("applyToOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("参加者でない場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // participants テーブルに該当なし
    mockSingle.mockReturnValue({ data: null, error: null });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加者登録が必要です");
  });

  it("案件が存在しない場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: { id: "user-123" }, error: null }; // m_participant_profile
      return { data: null, error: null }; // m_opportunity (なし)
    });

    const result: ApplyResult = await applyToOpportunity(
      "nonexistent",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("案件が見つかりません");
  });

  it("募集終了の案件にはエラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: { id: "user-123" }, error: null }; // m_participant_profile
      return { data: { id: "opp-1", status: "closed" }, error: null }; // m_opportunity
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("この案件は募集を終了しています");
  });

  it("公開予約中の案件には応募できない", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: { id: "user-123" }, error: null };
      return {
        data: {
          id: "opp-1",
          status: "published",
          published_at: "2999-01-01T00:00:00.000Z",
        },
        error: null,
      };
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("この案件は募集を終了しています");
  });

  it("重複応募の場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: { id: "user-123" }, error: null }; // m_participant_profile
      if (callCount === 2)
        return { data: { id: "opp-1", status: "published" }, error: null }; // m_opportunity
      return { data: { id: "app-existing" }, error: null }; // t_matching_candidate (既存)
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("この案件にはすでに応募済みです");
  });

  it("予期しないエラー時もクラッシュせずエラーを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });

  it("INSERT 成功時、success: true を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // m_participant_profile
        return { data: { id: "participant-1" }, error: null };
      }
      if (callCount === 2) {
        // m_opportunity（公開中）
        return { data: { id: "opp-1", status: "published" }, error: null };
      }
      // t_matching_candidate 重複チェック（応募なし）
      return { data: null, error: null };
    });

    // INSERT 成功
    mockInsert.mockReturnValue({ error: null });

    const result: ApplyResult = await applyToOpportunity("opp-1", "参加したいです");

    expect(result.success).toBe(true);
    // created_at / updated_at / applied_at が INSERT payload に含まれていることを確認
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunity_id: "opp-1",
        participant_id: "user-123",
        status: "applied",
        recommendation_log_id: null,
        message: "参加したいです",
        applied_at: expect.any(String),
        status_changed_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      })
    );
  });

  it("INSERT エラー時は '応募の送信に失敗しました' を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: { id: "participant-1" }, error: null };
      }
      if (callCount === 2) {
        return { data: { id: "opp-1", status: "published" }, error: null };
      }
      return { data: null, error: null };
    });

    // INSERT 失敗（updated_at missing など DB制約違反をシミュレート）
    mockInsert.mockReturnValue({
      error: { message: "null value in column \"updated_at\" violates not-null constraint" },
    });

    const result: ApplyResult = await applyToOpportunity("opp-1", "");

    expect(result.success).toBe(false);
    expect(result.error).toBe("応募の送信に失敗しました");
  });
});
