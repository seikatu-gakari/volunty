// Prisma シードスクリプト — 人物タイプマスタデータ + テスト用案件データの投入
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"]!,
});
const prisma = new PrismaClient({ adapter });

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

  // ============================================
  // テスト用団体ユーザー・団体プロフィール・募集案件の投入
  // ============================================

  // テスト用団体ユーザー（固定UUIDで冪等に upsert）
  const testOrgUsers = [
    {
      id: "00000000-0000-0000-0000-000000000001",
      email: "npo-green@example.com",
      name: "NPO法人グリーンアース 代表",
      role: "organization" as const,
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      email: "kodomo-mirai@example.com",
      name: "一般社団法人こどもみらい 事務局",
      role: "organization" as const,
    },
    {
      id: "00000000-0000-0000-0000-000000000003",
      email: "community-hub@example.com",
      name: "コミュニティハブ東京 運営",
      role: "organization" as const,
    },
    {
      id: "00000000-0000-0000-0000-000000000004",
      email: "culture-bridge@example.com",
      name: "NPO法人カルチャーブリッジ 代表",
      role: "organization" as const,
    },
  ];

  for (const u of testOrgUsers) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, name: u.name, role: u.role },
      create: { ...u, updatedAt: new Date() },
    });
  }
  console.log(`✅ テスト団体ユーザー: ${testOrgUsers.length}件を投入しました`);

  // テスト用団体プロフィール
  const testOrgs = [
    {
      userId: "00000000-0000-0000-0000-000000000001",
      organizationName: "NPO法人グリーンアース",
      description:
        "都市部の緑化活動と環境教育を推進するNPOです。地域の公園や河川敷での清掃・植樹活動を中心に、環境意識の向上を目指しています。",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["渋谷区", "世田谷区", "目黒区"],
      activityCategories: ["環境保全", "地域活性化"],
    },
    {
      userId: "00000000-0000-0000-0000-000000000002",
      organizationName: "一般社団法人こどもみらい",
      description:
        "子どもの学習支援と居場所づくりを行っています。放課後の学習教室や、休日のイベントを通じて子どもたちの健やかな成長を支えます。",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["新宿区", "豊島区"],
      activityCategories: ["子ども支援", "教育"],
    },
    {
      userId: "00000000-0000-0000-0000-000000000003",
      organizationName: "コミュニティハブ東京",
      description:
        "高齢者の見守り活動と多世代交流イベントを運営しています。地域のつながりを深め、孤立を防ぐコミュニティづくりに取り組んでいます。",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["文京区", "台東区", "荒川区"],
      activityCategories: ["高齢者支援", "地域活性化"],
    },
    {
      userId: "00000000-0000-0000-0000-000000000004",
      organizationName: "NPO法人カルチャーブリッジ",
      description:
        "多文化共生と国際交流を促進するNPOです。外国人住民の生活支援や日本語教室の運営、異文化交流イベントの企画を行っています。",
      verified: true,
      profileCompleteness: 100,
      activityAreas: ["港区", "品川区"],
      activityCategories: ["国際交流", "多文化共生"],
    },
  ];

  for (const org of testOrgs) {
    const existing = await prisma.organizationProfile.findUnique({
      where: { userId: org.userId },
    });
    if (!existing) {
      await prisma.organizationProfile.create({
        data: { ...org, updatedAt: new Date() },
      });
    } else {
      await prisma.organizationProfile.update({
        where: { userId: org.userId },
        data: {
          organizationName: org.organizationName,
          description: org.description,
          verified: org.verified,
          activityAreas: org.activityAreas,
          activityCategories: org.activityCategories,
        },
      });
    }
  }
  console.log(`✅ テスト団体プロフィール: ${testOrgs.length}件を投入しました`);

  // 団体プロフィールIDを取得（案件作成用）
  const orgProfiles = await prisma.organizationProfile.findMany({
    where: {
      userId: {
        in: testOrgUsers.map((u) => u.id),
      },
    },
    select: { id: true, userId: true },
  });
  const orgIdByUser: Record<string, string> = Object.fromEntries(
    orgProfiles.map((p: { userId: string; id: string }) => [p.userId, p.id])
  );

  // テスト用募集案件（多様な性格特性を要求）
  const testOpportunities = [
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000001"],
      title: "渋谷区の公園植樹ボランティア",
      description:
        "渋谷区内の公園で樹木の植え替え作業を行います。屋外での体力作業が中心です。チームで協力しながら進めるため、コミュニケーション力が活かせます。初心者歓迎！",
      requirementTraits: { extraversion: 65, conscientiousness: 70, openness: 60 },
      location: "東京都渋谷区 代々木公園",
      capacity: 20,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000001"],
      title: "環境教育ワークショップ企画・運営スタッフ",
      description:
        "小学生向けの環境教育プログラムを企画・運営していただきます。子どもたちに自然の大切さを伝えるクリエイティブなアイデアを歓迎します。",
      requirementTraits: { openness: 80, extraversion: 70, agreeableness: 75 },
      location: "東京都世田谷区 エコプラザ",
      capacity: 5,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000002"],
      title: "放課後学習サポート（小学生向け）",
      description:
        "小学3〜6年生を対象にした放課後の学習支援です。算数や国語の宿題を一緒に見ながら、子どもたちの『わかった！』を引き出すお手伝いをしてください。",
      requirementTraits: { agreeableness: 80, conscientiousness: 65 },
      location: "東京都新宿区 こどもみらい学習室",
      capacity: 8,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000002"],
      title: "夏休み子どもキャンプリーダー",
      description:
        "小学生対象の2泊3日キャンプのリーダーを募集します。アウトドア活動やレクリエーションの企画・進行を担当。責任感とチームワークが求められます。",
      requirementTraits: {
        extraversion: 80,
        agreeableness: 70,
        conscientiousness: 75,
        neuroticism: 30,
      },
      location: "東京都奥多摩町",
      capacity: 10,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000003"],
      title: "高齢者向け傾聴ボランティア",
      description:
        "一人暮らしの高齢者のご自宅を訪問し、お話し相手になっていただきます。特別なスキルは不要です。相手に寄り添い、ゆっくりお話を聞いてくださる方を求めています。",
      requirementTraits: { agreeableness: 85, neuroticism: 25, extraversion: 55 },
      location: "東京都文京区内（訪問先による）",
      capacity: 15,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000003"],
      title: "多世代交流フェスティバル運営スタッフ",
      description:
        "地域の子どもからお年寄りまで楽しめるフェスティバルの運営を手伝ってくれる方を募集します。会場設営、受付、ステージ進行などチームで活動します。",
      requirementTraits: {
        extraversion: 75,
        agreeableness: 70,
        openness: 65,
        conscientiousness: 60,
      },
      location: "東京都台東区 台東区民会館",
      capacity: 30,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000004"],
      title: "外国人住民向け日本語教室アシスタント",
      description:
        "地域に住む外国人の方への日本語教室のアシスタントです。日本語を教えた経験がなくても大丈夫。異文化コミュニケーションに興味がある方を歓迎します。",
      requirementTraits: { openness: 85, agreeableness: 75, extraversion: 60 },
      location: "東京都港区 国際交流センター",
      capacity: 6,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000004"],
      title: "多文化イベント広報・SNS運営",
      description:
        "異文化交流イベントのSNS広報やフライヤーデザインを担当していただきます。クリエイティブな発信でイベントを盛り上げてくれる方を募集中！",
      requirementTraits: { openness: 90, conscientiousness: 70 },
      location: "リモート可",
      capacity: 3,
      status: "published" as const,
      publishedAt: new Date(),
    },
  ];

  for (const opp of testOpportunities) {
    // title + organizationId の組み合わせで既存チェック
    const existing = await prisma.opportunity.findFirst({
      where: {
        title: opp.title,
        organizationId: opp.organizationId,
      },
    });
    if (!existing) {
      await prisma.opportunity.create({
        data: { ...opp, updatedAt: new Date() },
      });
    }
  }
  console.log(
    `✅ テスト募集案件: ${testOpportunities.length}件を投入しました`
  );
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
