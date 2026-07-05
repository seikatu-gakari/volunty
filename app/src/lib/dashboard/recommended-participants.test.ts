import { describe, expect, it } from "vitest";
import { buildRecommendedParticipants } from "./recommended-participants";

const neutralScores = {
  extraversion: 50,
  agreeableness: 50,
  conscientiousness: 50,
  emotionalStability: 50,
  intellect: 50,
};

function participant(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    userId: "user-1",
    name: "山田 花子",
    region: "東京都",
    interests: ["環境保全"],
    availability: null,
    preferredLocation: null,
    publicProfile: true,
    latestDiagnosisResult: {
      styleTypeId: "supporter-care",
      scaledScores: neutralScores,
    },
    ...overrides,
  };
}

describe("buildRecommendedParticipants", () => {
  it("活動スタイルタグに適合する参加者が上位になる", () => {
    const social = participant({
      id: "profile-social",
      userId: "user-social",
      name: "外向 太郎",
      latestDiagnosisResult: {
        styleTypeId: "charisma-entertainer",
        scaledScores: { ...neutralScores, extraversion: 80 },
      },
    });
    const neutral = participant({
      id: "profile-neutral",
      userId: "user-neutral",
      name: "中間 花子",
    });

    const opportunities = [
      {
        id: "opp-1",
        title: "イベント運営スタッフ",
        activityStyleTags: ["talk-with-new-people"],
      },
    ];

    const result = buildRecommendedParticipants([neutral, social], opportunities);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("profile-social");
    expect(result[0].bestOpportunityTitle).toBe("イベント運営スタッフ");
    expect(result[0].matchReasons[0]).toContain("初対面の人と多く話す");
    expect(result[0].styleTypeLabel).toBe("カリスマ・エンターテイナータイプ");
  });

  it("生の診断スコアを出力に含めない（団体へ開示しない）", () => {
    const result = buildRecommendedParticipants(
      [participant()],
      [{ id: "opp-1", title: "案件", activityStyleTags: ["empathy-support"] }]
    );

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("diagnosisScores");
    expect(result[0]).not.toHaveProperty("matchScore");
  });

  it("未診断の参加者も除外されない（性格で機会を奪わない）", () => {
    const undiagnosed = participant({
      id: "profile-undiagnosed",
      userId: "user-undiagnosed",
      name: "未診断 次郎",
      latestDiagnosisResult: null,
    });

    const result = buildRecommendedParticipants(
      [undiagnosed],
      [{ id: "opp-1", title: "案件", activityStyleTags: ["empathy-support"] }]
    );

    expect(result).toHaveLength(1);
    expect(result[0].styleTypeLabel).toBeNull();
    expect(result[0].matchReasons[0]).toContain("公開中募集案件");
  });

  it("非公開プロフィールの参加者は含めない", () => {
    const hidden = participant({ publicProfile: false });

    const result = buildRecommendedParticipants(
      [hidden],
      [{ id: "opp-1", title: "案件", activityStyleTags: [] }]
    );

    expect(result).toHaveLength(0);
  });

  it("公開中の募集案件がない場合は空を返す", () => {
    const result = buildRecommendedParticipants([participant()], []);
    expect(result).toEqual([]);
  });

  it("同率の場合は名前 → ID の順で決定的にソートされる", () => {
    const a = participant({ id: "profile-a", userId: "user-a", name: "あおい" });
    const b = participant({ id: "profile-b", userId: "user-b", name: "いろは" });

    const opportunities = [
      { id: "opp-1", title: "案件", activityStyleTags: [] },
    ];

    const first = buildRecommendedParticipants([b, a], opportunities);
    const second = buildRecommendedParticipants([b, a], opportunities);

    expect(first.map((p) => p.id)).toEqual(["profile-a", "profile-b"]);
    expect(first).toEqual(second);
  });
});
