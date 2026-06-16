import { describe, expect, it } from "vitest";
import { buildRecommendedParticipants } from "./recommended-participants";

const completeScores = {
  agreeableness: 50,
  conscientiousness: 50,
  extraversion: 50,
  neuroticism: 50,
  openness: 50,
};

describe("buildRecommendedParticipants", () => {
  it("公開済み・診断済み参加者を最高相性の募集案件スコア順で返す", () => {
    const participants = [
      {
        id: "profile-1",
        userId: "user-1",
        name: "山田 花子",
        region: "東京都",
        interests: ["環境保全"],
        availability: null,
        preferredLocation: null,
        publicProfile: true,
        diagnosisType: "innovator-leader",
        diagnosisMode: "brief",
        diagnosisScores: { ...completeScores, extraversion: 80 },
      },
      {
        id: "profile-2",
        userId: "user-2",
        name: "佐藤 太郎",
        region: "神奈川県",
        interests: ["教育"],
        availability: null,
        preferredLocation: null,
        publicProfile: true,
        diagnosisType: null,
        diagnosisMode: null,
        diagnosisScores: { ...completeScores, extraversion: 70 },
      },
    ];

    const opportunities = [
      {
        id: "opp-1",
        title: "落ち着いた事務サポート",
        requirementTraits: { extraversion: 30 },
      },
      {
        id: "opp-2",
        title: "イベントリーダー",
        requirementTraits: { extraversion: 80 },
      },
    ];

    const result = buildRecommendedParticipants(participants, opportunities);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "profile-1",
      name: "山田 花子",
      matchScore: 100,
      bestOpportunityId: "opp-2",
      bestOpportunityTitle: "イベントリーダー",
      interests: ["環境保全"],
    });
    expect(result[1]).toMatchObject({
      id: "profile-2",
      matchScore: 90,
      bestOpportunityId: "opp-2",
    });
  });

  it("非公開プロフィールと診断スコア不正の参加者を除外する", () => {
    const participants = [
      {
        id: "profile-public",
        userId: "user-public",
        name: "公開 参加者",
        region: "東京都",
        interests: [],
        availability: null,
        preferredLocation: null,
        publicProfile: true,
        diagnosisType: null,
        diagnosisMode: null,
        diagnosisScores: completeScores,
      },
      {
        id: "profile-private",
        userId: "user-private",
        name: "非公開 参加者",
        region: "東京都",
        interests: [],
        availability: null,
        preferredLocation: null,
        publicProfile: false,
        diagnosisType: null,
        diagnosisMode: null,
        diagnosisScores: completeScores,
      },
      {
        id: "profile-invalid",
        userId: "user-invalid",
        name: "未診断 参加者",
        region: "東京都",
        interests: [],
        availability: null,
        preferredLocation: null,
        publicProfile: true,
        diagnosisType: null,
        diagnosisMode: null,
        diagnosisScores: { extraversion: 70 },
      },
    ];

    const result = buildRecommendedParticipants(participants, [
      {
        id: "opp-1",
        title: "環境イベント",
        requirementTraits: { extraversion: 50 },
      },
    ]);

    expect(result.map((participant) => participant.id)).toEqual([
      "profile-public",
    ]);
  });

  it("同点の場合は表示名、プロフィールIDの順で安定ソートする", () => {
    const participants = [
      {
        id: "profile-b",
        userId: "user-b",
        name: "Bさん",
        region: "東京都",
        interests: [],
        availability: null,
        preferredLocation: null,
        publicProfile: true,
        diagnosisType: null,
        diagnosisMode: null,
        diagnosisScores: completeScores,
      },
      {
        id: "profile-a",
        userId: "user-a",
        name: "Aさん",
        region: "東京都",
        interests: [],
        availability: null,
        preferredLocation: null,
        publicProfile: true,
        diagnosisType: null,
        diagnosisMode: null,
        diagnosisScores: completeScores,
      },
    ];

    const result = buildRecommendedParticipants(participants, [
      {
        id: "opp-1",
        title: "地域イベント",
        requirementTraits: completeScores,
      },
    ]);

    expect(result.map((participant) => participant.id)).toEqual([
      "profile-a",
      "profile-b",
    ]);
  });

  it("募集案件の要件特性が未指定の場合は既存仕様どおり50点にする", () => {
    const result = buildRecommendedParticipants(
      [
        {
          id: "profile-1",
          userId: "user-1",
          name: "山田 花子",
          region: "東京都",
          interests: [],
          availability: null,
          preferredLocation: null,
          publicProfile: true,
          diagnosisType: null,
          diagnosisMode: null,
          diagnosisScores: completeScores,
        },
      ],
      [
        {
          id: "opp-1",
          title: "要件未指定の募集",
          requirementTraits: null,
        },
      ]
    );

    expect(result[0]).toMatchObject({
      matchScore: 50,
      bestOpportunityId: "opp-1",
      bestOpportunityTitle: "要件未指定の募集",
    });
  });
});
