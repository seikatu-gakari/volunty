// Prisma シードスクリプト — 人物タイプマスタデータの投入
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// 10類型の人物タイプマスタデータ（constants.ts と同期）
const personalityTypes = [
  {
    typeId: "innovator-leader",
    nameJa: "イノベーター・リーダータイプ",
    nameEn: "Innovator Leader",
    description: "新しいアイデアを積極的に提案し、チームを牽引する",
    criteria: {
      extraversion: { min: 75 },
      openness: { min: 80 },
      conscientiousness: { min: 70 },
    },
    priority: 1,
    strengths: ["プロジェクトリーダー", "企画立案", "新規事業開発"],
    suitableActivities: [
      "イベント統括",
      "社会課題の新規アプローチ開発",
    ],
  },
  {
    typeId: "supporter-care",
    nameJa: "サポーター・ケアタイプ",
    nameEn: "Supporter Care",
    description: "他人の感情に敏感で、献身的にサポート",
    criteria: {
      agreeableness: { min: 80 },
      extraversion: { min: 60 },
      neuroticism: { max: 40 },
    },
    priority: 2,
    strengths: ["高齢者支援", "障がい者サポート", "傾聴ボランティア"],
    suitableActivities: ["個別相談", "継続的な見守り活動"],
  },
  {
    typeId: "creative-solo",
    nameJa: "クリエイティブ・ソロタイプ",
    nameEn: "Creative Solo",
    description: "独創的なアイデアを一人で深く追求",
    criteria: {
      openness: { min: 95 },
      extraversion: { max: 20 },
      conscientiousness: { min: 60 },
    },
    priority: 3,
    strengths: ["デザイン制作", "ライティング", "動画編集"],
    suitableActivities: [
      "広報物作成",
      "アート制作",
      "静かな環境での作業",
    ],
  },
  {
    typeId: "perfectionist-analyst",
    nameJa: "パーフェクショニスト・アナリストタイプ",
    nameEn: "Perfectionist Analyst",
    description: "細部まで完璧を追求し、高い品質基準を持つ",
    criteria: {
      conscientiousness: { min: 95 },
      neuroticism: { min: 70 },
      openness: { min: 50 },
    },
    priority: 4,
    strengths: ["データ入力", "会計管理", "記録作成"],
    suitableActivities: [
      "精密な作業",
      "品質チェック",
      "ドキュメント整備",
    ],
  },
  {
    typeId: "charisma-entertainer",
    nameJa: "カリスマ・エンターテイナータイプ",
    nameEn: "Charisma Entertainer",
    description: "人を惹きつけ、楽しい雰囲気を作り出す",
    criteria: {
      extraversion: { min: 95 },
      agreeableness: { min: 80 },
      openness: { min: 85 },
    },
    priority: 5,
    strengths: ["子どもイベント", "募金活動", "PR 活動"],
    suitableActivities: ["ステージ進行", "来場者対応", "SNS 発信"],
  },
  {
    typeId: "strategist-planner",
    nameJa: "ストラテジスト・プランナータイプ",
    nameEn: "Strategist Planner",
    description: "長期的視点で戦略を立て、確実に実行",
    criteria: {
      conscientiousness: { min: 90 },
      openness: { min: 75 },
      neuroticism: { max: 40 },
    },
    priority: 6,
    strengths: [
      "プロジェクトマネジメント",
      "予算管理",
      "進捗管理",
    ],
    suitableActivities: ["企画全体の設計", "リスク管理", "成果測定"],
  },
  {
    typeId: "harmony-mediator",
    nameJa: "ハーモニー・メディエータータイプ",
    nameEn: "Harmony Mediator",
    description: "対立を避け、チーム内の調和を重視",
    criteria: {
      agreeableness: { min: 95 },
      neuroticism: { max: 35 },
      extraversion: { min: 60 },
    },
    priority: 7,
    strengths: ["チーム調整", "意見とりまとめ", "紛争解決"],
    suitableActivities: [
      "ファシリテーション",
      "多様な参加者の橋渡し",
    ],
  },
  {
    typeId: "adventure-explorer",
    nameJa: "アドベンチャー・エクスプローラータイプ",
    nameEn: "Adventure Explorer",
    description: "新しい経験や冒険を求め、リスクを恐れない",
    criteria: {
      openness: { min: 90 },
      extraversion: { min: 85 },
      neuroticism: { max: 25 },
    },
    priority: 8,
    strengths: ["屋外活動", "被災地支援", "海外ボランティア"],
    suitableActivities: [
      "身体を使う活動",
      "未知の環境への対応",
    ],
  },
  {
    typeId: "conservative-guardian",
    nameJa: "コンサバティブ・ガーディアンタイプ",
    nameEn: "Conservative Guardian",
    description: "伝統や規則を重視し、安定を求める",
    criteria: {
      conscientiousness: { min: 85 },
      agreeableness: { min: 75 },
      openness: { max: 30 },
    },
    priority: 9,
    strengths: ["定例活動", "ルール遵守", "安全管理"],
    suitableActivities: [
      "継続的な地域清掃",
      "伝統行事の運営補助",
    ],
  },
  {
    typeId: "sensitive-artist",
    nameJa: "センシティブ・アーティストタイプ",
    nameEn: "Sensitive Artist",
    description: "感受性が豊かで、繊細な表現を得意とする",
    criteria: {
      openness: { min: 90 },
      neuroticism: { min: 75 },
      extraversion: { max: 35 },
    },
    priority: 10,
    strengths: ["音楽演奏", "詩の朗読", "アート療法"],
    suitableActivities: [
      "少人数の穏やかな環境での創作活動",
    ],
  },
];

async function main() {
  console.log("🌱 シードデータの投入を開始...");

  // 人物タイプマスタの upsert
  for (const type of personalityTypes) {
    await prisma.personalityType.upsert({
      where: { typeId: type.typeId },
      update: {
        nameJa: type.nameJa,
        nameEn: type.nameEn,
        description: type.description,
        criteria: type.criteria,
        priority: type.priority,
        strengths: type.strengths,
        suitableActivities: type.suitableActivities,
      },
      create: type,
    });
  }

  console.log(`✅ 人物タイプマスタ: ${personalityTypes.length}件を投入しました`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ シードデータの投入に失敗:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
