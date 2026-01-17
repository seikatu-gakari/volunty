import { Question, PersonalityType } from './types'

export const BIG5_QUESTIONS: Question[] = [
  // 外向性 (Extraversion)
  {
    id: 'e1',
    text: '初対面の人とも気軽に話しかけることができる',
    trait: 'extraversion',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e2',
    text: '大勢の前で話すのは苦手だ',
    trait: 'extraversion',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e3',
    text: 'パーティーや社交的な集まりが好きだ',
    trait: 'extraversion',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e4',
    text: 'あまり自分からは話さない',
    trait: 'extraversion',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e5',
    text: '注目の的になるのが好きだ',
    trait: 'extraversion',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e6',
    text: '静かな環境で過ごすのが好きだ',
    trait: 'extraversion',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e7',
    text: '会話をリードすることが多い',
    trait: 'extraversion',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e8',
    text: '人付き合いは疲れると感じる',
    trait: 'extraversion',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e9',
    text: '活気のある場所に行くと元気になる',
    trait: 'extraversion',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e10',
    text: '休日は家で一人で過ごしたい',
    trait: 'extraversion',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },

  // 協調性 (Agreeableness)
  {
    id: 'a1',
    text: '他人の気持ちを理解しようと努める',
    trait: 'agreeableness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a2',
    text: '他人の欠点ばかり気になってしまう',
    trait: 'agreeableness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a3',
    text: '困っている人を見ると放っておけない',
    trait: 'agreeableness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a4',
    text: '自分の利益を最優先に考える',
    trait: 'agreeableness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a5',
    text: '人から信頼されることが多い',
    trait: 'agreeableness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a6',
    text: '他人に対して批判的になりがちだ',
    trait: 'agreeableness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a7',
    text: 'チームワークを大切にする',
    trait: 'agreeableness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a8',
    text: '人と衝突することを恐れない',
    trait: 'agreeableness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a9',
    text: '誰にでも親切に接するよう心がけている',
    trait: 'agreeableness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'a10',
    text: '他人の問題には関わりたくない',
    trait: 'agreeableness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },

  // 誠実性 (Conscientiousness)
  {
    id: 'c1',
    text: '計画を立ててから行動することが多い',
    trait: 'conscientiousness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c2',
    text: '部屋や机の上は散らかっていることが多い',
    trait: 'conscientiousness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c3',
    text: '約束や期限は必ず守る',
    trait: 'conscientiousness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c4',
    text: '物事を先延ばしにする癖がある',
    trait: 'conscientiousness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c5',
    text: '細部まで注意を払って作業する',
    trait: 'conscientiousness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c6',
    text: '行き当たりばったりで行動することが多い',
    trait: 'conscientiousness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c7',
    text: '目標に向かってコツコツ努力できる',
    trait: 'conscientiousness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c8',
    text: '飽きっぽく、物事が長続きしない',
    trait: 'conscientiousness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c9',
    text: '準備は入念に行う方だ',
    trait: 'conscientiousness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'c10',
    text: '細かいことは気にしない',
    trait: 'conscientiousness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },

  // 神経症傾向 (Neuroticism)
  {
    id: 'n1',
    text: '小さなことでも心配してしまう',
    trait: 'neuroticism',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n2',
    text: '普段からリラックスしている',
    trait: 'neuroticism',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n3',
    text: '気分が落ち込みやすい',
    trait: 'neuroticism',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n4',
    text: 'ストレスを感じにくい',
    trait: 'neuroticism',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n5',
    text: '感情の起伏が激しい方だ',
    trait: 'neuroticism',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n6',
    text: '困難な状況でも冷静でいられる',
    trait: 'neuroticism',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n7',
    text: '些細なことでイライラしてしまう',
    trait: 'neuroticism',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n8',
    text: '自分に自信を持っている',
    trait: 'neuroticism',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n9',
    text: '将来に対して不安を感じることが多い',
    trait: 'neuroticism',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'n10',
    text: '精神的に安定している',
    trait: 'neuroticism',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },

  // 開放性 (Openness)
  {
    id: 'o1',
    text: '新しいアイデアや経験を求める',
    trait: 'openness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o2',
    text: '変化よりも安定を好む',
    trait: 'openness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o3',
    text: '芸術や音楽に深く感動することがある',
    trait: 'openness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o4',
    text: '抽象的な議論は苦手だ',
    trait: 'openness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o5',
    text: '想像力が豊かだと思う',
    trait: 'openness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o6',
    text: '決まった手順で作業する方が好きだ',
    trait: 'openness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o7',
    text: '知的好奇心が旺盛だ',
    trait: 'openness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o8',
    text: '空想にふけることは時間の無駄だと思う',
    trait: 'openness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o9',
    text: '独創的な解決策を考えるのが得意だ',
    trait: 'openness',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'o10',
    text: '伝統や慣習を重んじる',
    trait: 'openness',
    reversed: true,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  }
]

export const PERSONALITY_TYPES: PersonalityType[] = [
  {
    id: 'innovator-leader',
    name: 'イノベーター・リーダータイプ',
    nameEn: 'Innovator Leader',
    criteria: {
      extraversion: { min: 75 },
      openness: { min: 80 },
      conscientiousness: { min: 70 }
    },
    priority: 1,
    description: '新しいアイデアを積極的に提案し、チームを牽引する',
    strengths: ['プロジェクトリーダー', '企画立案', '新規事業開発'],
    suitableActivities: ['イベント統括', '社会課題の新規アプローチ開発']
  },
  {
    id: 'supporter-care',
    name: 'サポーター・ケアタイプ',
    nameEn: 'Supporter Care',
    criteria: {
      agreeableness: { min: 80 },
      extraversion: { min: 60 },
      neuroticism: { max: 40 }
    },
    priority: 2,
    description: '他人の感情に敏感で、献身的にサポート',
    strengths: ['高齢者支援', '障がい者サポート', '傾聴ボランティア'],
    suitableActivities: ['個別相談', '継続的な見守り活動']
  },
  {
    id: 'creative-solo',
    name: 'クリエイティブ・ソロタイプ',
    nameEn: 'Creative Solo',
    criteria: {
      openness: { min: 95 },
      extraversion: { max: 20 },
      conscientiousness: { min: 60 }
    },
    priority: 3,
    description: '独創的なアイデアを一人で深く追求',
    strengths: ['デザイン制作', 'ライティング', '動画編集'],
    suitableActivities: ['広報物作成', 'アート制作', '静かな環境での作業']
  },
  {
    id: 'perfectionist-analyst',
    name: 'パーフェクショニスト・アナリストタイプ',
    nameEn: 'Perfectionist Analyst',
    criteria: {
      conscientiousness: { min: 95 },
      neuroticism: { min: 70 },
      openness: { min: 50 }
    },
    priority: 4,
    description: '細部まで完璧を追求し、高い品質基準を持つ',
    strengths: ['データ入力', '会計管理', '記録作成'],
    suitableActivities: ['精密な作業', '品質チェック', 'ドキュメント整備']
  },
  {
    id: 'charisma-entertainer',
    name: 'カリスマ・エンターテイナータイプ',
    nameEn: 'Charisma Entertainer',
    criteria: {
      extraversion: { min: 95 },
      agreeableness: { min: 80 },
      openness: { min: 85 }
    },
    priority: 5,
    description: '人を惹きつけ、楽しい雰囲気を作り出す',
    strengths: ['子どもイベント', '募金活動', 'PR 活動'],
    suitableActivities: ['ステージ進行', '来場者対応', 'SNS 発信']
  },
  {
    id: 'strategist-planner',
    name: 'ストラテジスト・プランナータイプ',
    nameEn: 'Strategist Planner',
    criteria: {
      conscientiousness: { min: 90 },
      openness: { min: 75 },
      neuroticism: { max: 40 }
    },
    priority: 6,
    description: '長期的視点で戦略を立て、確実に実行',
    strengths: ['プロジェクトマネジメント', '予算管理', '進捗管理'],
    suitableActivities: ['企画全体の設計', 'リスク管理', '成果測定']
  },
  {
    id: 'harmony-mediator',
    name: 'ハーモニー・メディエータータイプ',
    nameEn: 'Harmony Mediator',
    criteria: {
      agreeableness: { min: 95 },
      neuroticism: { max: 35 },
      extraversion: { min: 60 }
    },
    priority: 7,
    description: '対立を避け、チーム内の調和を重視',
    strengths: ['チーム調整', '意見とりまとめ', '紛争解決'],
    suitableActivities: ['ファシリテーション', '多様な参加者の橋渡し']
  },
  {
    id: 'adventure-explorer',
    name: 'アドベンチャー・エクスプローラータイプ',
    nameEn: 'Adventure Explorer',
    criteria: {
      openness: { min: 90 },
      extraversion: { min: 85 },
      neuroticism: { max: 25 }
    },
    priority: 8,
    description: '新しい経験や冒険を求め、リスクを恐れない',
    strengths: ['屋外活動', '被災地支援', '海外ボランティア'],
    suitableActivities: ['身体を使う活動', '未知の環境への対応']
  },
  {
    id: 'conservative-guardian',
    name: 'コンサバティブ・ガーディアンタイプ',
    nameEn: 'Conservative Guardian',
    criteria: {
      conscientiousness: { min: 85 },
      agreeableness: { min: 75 },
      openness: { max: 30 }
    },
    priority: 9,
    description: '伝統や規則を重視し、安定を求める',
    strengths: ['定例活動', 'ルール遵守', '安全管理'],
    suitableActivities: ['継続的な地域清掃', '伝統行事の運営補助']
  },
  {
    id: 'sensitive-artist',
    name: 'センシティブ・アーティストタイプ',
    nameEn: 'Sensitive Artist',
    criteria: {
      openness: { min: 90 },
      neuroticism: { min: 75 },
      extraversion: { max: 35 }
    },
    priority: 10,
    description: '感受性が豊かで、繊細な表現を得意とする',
    strengths: ['音楽演奏', '詩の朗読', 'アート療法'],
    suitableActivities: ['少人数の穏やかな環境での創作活動']
  }
]
