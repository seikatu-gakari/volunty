// Prisma シードスクリプト — テスト用団体・募集案件データの投入
// 旧「人物タイプマスタ」は廃止（参考タイプはコード定数 src/lib/diagnosis-scale/style-types.ts で管理）
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"]!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 シードデータの投入を開始...");

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

  const today = new Date();
  const inDays = (days: number) =>
    new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  // テスト用募集案件
  // activityStyleTags は src/lib/recommendations/activity-style-tags.ts のタグID（最大3・加点のみ）
  const testOpportunities = [
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000001"],
      title: "渋谷区の公園植樹ボランティア",
      description:
        "渋谷区内の公園で樹木の植え替え作業を行います。屋外での体力作業が中心です。チームで協力しながら進めるため、コミュニケーション力が活かせます。初心者歓迎！",
      activityStyleTags: ["talk-with-new-people", "routine-steady-work"],
      location: "東京都渋谷区 代々木公園",
      startDate: inDays(14),
      endDate: inDays(14),
      capacity: 20,
      category: "環境保全",
      participationMode: "offline" as const,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000001"],
      title: "環境教育ワークショップ企画・運営スタッフ",
      description:
        "小学生向けの環境教育プログラムを企画・運営していただきます。子どもたちに自然の大切さを伝えるクリエイティブなアイデアを歓迎します。",
      activityStyleTags: ["creative-ideas", "talk-with-new-people"],
      location: "東京都世田谷区 エコプラザ",
      startDate: inDays(7),
      endDate: inDays(60),
      capacity: 5,
      category: "環境保全",
      participationMode: "offline" as const,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000002"],
      title: "放課後学習サポート（小学生向け）",
      description:
        "小学3〜6年生を対象にした放課後の学習支援です。算数や国語の宿題を一緒に見ながら、子どもたちの『わかった！』を引き出すお手伝いをしてください。",
      activityStyleTags: ["empathy-support", "precise-scheduled-work"],
      location: "東京都新宿区 こどもみらい学習室",
      startDate: inDays(3),
      endDate: inDays(90),
      capacity: 8,
      category: "子ども支援",
      participationMode: "offline" as const,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000002"],
      title: "夏休み子どもキャンプリーダー",
      description:
        "小学生対象の2泊3日キャンプのリーダーを募集します。アウトドア活動やレクリエーションの企画・進行を担当。18歳以上の方が対象です。",
      activityStyleTags: [
        "talk-with-new-people",
        "calm-under-change",
        "precise-scheduled-work",
      ],
      minAge: 18,
      location: "東京都奥多摩町",
      startDate: inDays(30),
      endDate: inDays(32),
      capacity: 10,
      category: "子ども支援",
      participationMode: "offline" as const,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000003"],
      title: "高齢者向け傾聴ボランティア",
      description:
        "一人暮らしの高齢者のご自宅を訪問し、お話し相手になっていただきます。特別なスキルは不要です。相手に寄り添い、ゆっくりお話を聞いてくださる方を求めています。",
      activityStyleTags: ["empathy-support", "calm-under-change"],
      location: "東京都文京区内（訪問先による）",
      startDate: inDays(7),
      endDate: inDays(180),
      capacity: 15,
      category: "高齢者支援",
      participationMode: "offline" as const,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000003"],
      title: "多世代交流フェスティバル運営スタッフ",
      description:
        "地域の子どもからお年寄りまで楽しめるフェスティバルの運営を手伝ってくれる方を募集します。会場設営、受付、ステージ進行などチームで活動します。",
      activityStyleTags: ["talk-with-new-people", "calm-under-change"],
      location: "東京都台東区 台東区民会館",
      startDate: inDays(21),
      endDate: inDays(21),
      capacity: 30,
      category: "地域活性化",
      participationMode: "offline" as const,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000004"],
      title: "外国人住民向け日本語教室アシスタント",
      description:
        "地域に住む外国人の方への日本語教室のアシスタントです。日本語を教えた経験がなくても大丈夫。異文化コミュニケーションに興味がある方を歓迎します。",
      activityStyleTags: ["empathy-support", "creative-ideas"],
      location: "東京都港区 国際交流センター",
      startDate: inDays(7),
      endDate: inDays(120),
      capacity: 6,
      category: "国際交流",
      participationMode: "hybrid" as const,
      status: "published" as const,
      publishedAt: new Date(),
    },
    {
      organizationId: orgIdByUser["00000000-0000-0000-0000-000000000004"],
      title: "多文化イベント広報・SNS運営",
      description:
        "異文化交流イベントのSNS広報やフライヤーデザインを担当していただきます。クリエイティブな発信でイベントを盛り上げてくれる方を募集中！",
      activityStyleTags: ["creative-ideas", "solo-focused-work"],
      location: "リモート可",
      startDate: inDays(1),
      endDate: inDays(90),
      capacity: 3,
      category: "国際交流",
      participationMode: "online" as const,
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
    } else {
      await prisma.opportunity.update({
        where: { id: existing.id },
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
