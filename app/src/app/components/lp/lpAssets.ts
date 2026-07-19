interface LPAsset {
  src: `/lp/mobile/${string}`;
  alt: string;
  width: number;
  height: number;
  objectPosition?: string;
}

export const lpAssets = {
  brandMark: {
    src: "/lp/mobile/brand-mark.png",
    alt: "",
    width: 1254,
    height: 1254,
  },
  orbitMotif: {
    src: "/lp/mobile/orbit-motif.png",
    alt: "",
    width: 1254,
    height: 1254,
  },
  heroCleanup: {
    src: "/lp/mobile/hero-cleanup.png",
    alt: "公園で清掃ボランティアに参加する若者たち",
    width: 1448,
    height: 1086,
    objectPosition: "50% 46%",
  },
  styleSupporter: {
    src: "/lp/mobile/style-supporter.png",
    alt: "子どもの工作を支えるボランティア",
    width: 1448,
    height: 1086,
  },
  styleExplorer: {
    src: "/lp/mobile/style-explorer.png",
    alt: "自然保全活動へ向かうボランティア",
    width: 1448,
    height: 1086,
  },
  styleMediator: {
    src: "/lp/mobile/style-mediator.png",
    alt: "地域イベントで受付を支えるボランティア",
    width: 1448,
    height: 1086,
  },
  styleCreative: {
    src: "/lp/mobile/style-creative.png",
    alt: "子ども向け工作の準備をするボランティア",
    width: 1448,
    height: 1086,
  },
  painWelcome: {
    src: "/lp/mobile/pain-welcome.png",
    alt: "初参加の人を笑顔で迎えるボランティアスタッフ",
    width: 1448,
    height: 1086,
  },
  stepDiagnosis: {
    src: "/lp/mobile/step-diagnosis.png",
    alt: "スマートフォンで性格傾向チェックに回答する人",
    width: 1448,
    height: 1086,
  },
  stepMatching: {
    src: "/lp/mobile/step-matching.png",
    alt: "スマートフォンでおすすめ活動を探す様子",
    width: 1448,
    height: 1086,
  },
  benefitFestival: {
    src: "/lp/mobile/benefit-festival.png",
    alt: "地域のお祭りを一緒に準備するボランティア",
    width: 1448,
    height: 1086,
  },
  benefitThanks: {
    src: "/lp/mobile/benefit-thanks.png",
    alt: "子どもから感謝のカードを受け取るボランティア",
    width: 1448,
    height: 1086,
  },
  benefitRecord: {
    src: "/lp/mobile/benefit-record.png",
    alt: "活動後にスマートフォンで参加記録を確認する人たち",
    width: 1448,
    height: 1086,
  },
  voiceFirst: {
    src: "/lp/mobile/voice-first.png",
    alt: "初めての活動をスマートフォンで探す参加者",
    width: 1254,
    height: 1254,
  },
  voiceMonthly: {
    src: "/lp/mobile/voice-monthly.png",
    alt: "月に一度ボランティアへ参加する人",
    width: 1254,
    height: 1254,
  },
  voiceOrganization: {
    src: "/lp/mobile/voice-organization.png",
    alt: "地域活動について相談するNPOスタッフ",
    width: 1448,
    height: 1086,
  },
} as const satisfies Record<string, LPAsset>;
