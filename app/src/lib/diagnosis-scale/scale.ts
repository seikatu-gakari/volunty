import type { ScaleDefinition, ScaleItem } from './types'

/**
 * IPIP Lexical Big-Five Factor Markers 50項目 日本語版
 *
 * 出典（一次資料・確認日 2026-07-04）:
 * - 日本語項目: https://ipip.ori.org/JapaneseBig-FiveFactorMarkers.htm （Minoru Nakayama 訳）
 * - 採点キー:   https://ipip.ori.org/newBigFive5broadKey.htm （10項目版キー）
 * - 利用許諾:   https://ipip.ori.org/newPermission.htm
 *   「the IPIP has been placed in the public domain」
 *   「permission has already been automatically granted for any person to use
 *    IPIP items, scales, and inventories for any purpose, commercial or non-commercial」
 * - 日本語版の検証研究: Apple, M. T., & Neff, P. (2012). Using Rasch measurement to
 *   validate the Big Five factor marker questionnaire for a Japanese university
 *   population. Journal of Applied Measurement, 13, 1-21.
 *
 * 注意: 日本語項目文は出典の文言を改変しない。改変する場合は scaleVersion を
 * 更新し、独自改変版であることを明示する必要がある。
 */

/** 採点ロジックの版。丸め・変換方法の変更で更新する */
export const SCORING_ALGORITHM_VERSION = '1.0.0'

/**
 * 標準化データの版。適切な日本人向け標準化データが存在しないため null。
 * null の間は percentile・T得点・「上位◯%」を計算・表示してはならない。
 */
export const NORMS_VERSION: string | null = null

/** 回答選択肢（5件法）。全項目共通 */
export const LIKERT_OPTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: '全く当てはまらない', value: 1 },
  { label: 'あまり当てはまらない', value: 2 },
  { label: 'どちらともいえない', value: 3 },
  { label: 'やや当てはまる', value: 4 },
  { label: '非常に当てはまる', value: 5 },
] as const

// 一次資料の項目番号（displayOrder）順。domain / keyed は公式採点キーによる。
const ITEMS: ScaleItem[] = [
  { itemCode: 'ipip-bfm50-e01', displayOrder: 1, domain: 'extraversion', keyed: '+', textJa: '盛り上げ役である', textEnOriginal: 'Am the life of the party.' },
  { itemCode: 'ipip-bfm50-a01', displayOrder: 2, domain: 'agreeableness', keyed: '-', textJa: '他人を気づかうことはない', textEnOriginal: 'Feel little concern for others.' },
  { itemCode: 'ipip-bfm50-c01', displayOrder: 3, domain: 'conscientiousness', keyed: '+', textJa: 'いつも用意周到である', textEnOriginal: 'Am always prepared.' },
  { itemCode: 'ipip-bfm50-s01', displayOrder: 4, domain: 'emotionalStability', keyed: '-', textJa: 'すぐにストレスがたまってしまう', textEnOriginal: 'Get stressed out easily.' },
  { itemCode: 'ipip-bfm50-i01', displayOrder: 5, domain: 'intellect', keyed: '+', textJa: '語彙が豊富である', textEnOriginal: 'Have a rich vocabulary.' },
  { itemCode: 'ipip-bfm50-e02', displayOrder: 6, domain: 'extraversion', keyed: '-', textJa: 'おしゃべりではない', textEnOriginal: "Don't talk a lot." },
  { itemCode: 'ipip-bfm50-a02', displayOrder: 7, domain: 'agreeableness', keyed: '+', textJa: '他人に興味がある', textEnOriginal: 'Am interested in people.' },
  { itemCode: 'ipip-bfm50-c02', displayOrder: 8, domain: 'conscientiousness', keyed: '-', textJa: '持ち物が整理できないほうだ', textEnOriginal: 'Leave my belongings around.' },
  { itemCode: 'ipip-bfm50-s02', displayOrder: 9, domain: 'emotionalStability', keyed: '+', textJa: 'いつもリラックスしていることが多い', textEnOriginal: 'Am relaxed most of the time.' },
  { itemCode: 'ipip-bfm50-i02', displayOrder: 10, domain: 'intellect', keyed: '-', textJa: '抽象的な考えを理解するのが苦手だ', textEnOriginal: 'Have difficulty understanding abstract ideas.' },
  { itemCode: 'ipip-bfm50-e03', displayOrder: 11, domain: 'extraversion', keyed: '+', textJa: '人前でもあがらない', textEnOriginal: 'Feel comfortable around people.' },
  { itemCode: 'ipip-bfm50-a03', displayOrder: 12, domain: 'agreeableness', keyed: '-', textJa: '人を馬鹿にするほうだ', textEnOriginal: 'Insult people.' },
  { itemCode: 'ipip-bfm50-c03', displayOrder: 13, domain: 'conscientiousness', keyed: '+', textJa: '細かいことに気がつく', textEnOriginal: 'Pay attention to details.' },
  { itemCode: 'ipip-bfm50-s03', displayOrder: 14, domain: 'emotionalStability', keyed: '-', textJa: '心配性である', textEnOriginal: 'Worry about things.' },
  { itemCode: 'ipip-bfm50-i03', displayOrder: 15, domain: 'intellect', keyed: '+', textJa: '想像力が豊かである', textEnOriginal: 'Have a vivid imagination.' },
  { itemCode: 'ipip-bfm50-e04', displayOrder: 16, domain: 'extraversion', keyed: '-', textJa: '引っ込み思案である', textEnOriginal: 'Keep in the background.' },
  { itemCode: 'ipip-bfm50-a04', displayOrder: 17, domain: 'agreeableness', keyed: '+', textJa: '人に共感しやすい', textEnOriginal: "Sympathize with others' feelings." },
  { itemCode: 'ipip-bfm50-c04', displayOrder: 18, domain: 'conscientiousness', keyed: '-', textJa: '無茶なことをする', textEnOriginal: 'Make a mess of things.' },
  { itemCode: 'ipip-bfm50-s04', displayOrder: 19, domain: 'emotionalStability', keyed: '+', textJa: '落ち込むことはめったにない', textEnOriginal: 'Seldom feel blue.' },
  { itemCode: 'ipip-bfm50-i04', displayOrder: 20, domain: 'intellect', keyed: '-', textJa: '抽象的な考えには興味がない', textEnOriginal: 'Am not interested in abstract ideas.' },
  { itemCode: 'ipip-bfm50-e05', displayOrder: 21, domain: 'extraversion', keyed: '+', textJa: '自分から話しかけるほうである', textEnOriginal: 'Start conversations.' },
  { itemCode: 'ipip-bfm50-a05', displayOrder: 22, domain: 'agreeableness', keyed: '-', textJa: '他人の問題には興味がない', textEnOriginal: "Am not interested in other people's problems." },
  { itemCode: 'ipip-bfm50-c05', displayOrder: 23, domain: 'conscientiousness', keyed: '+', textJa: 'すぐに雑用を済ませる', textEnOriginal: 'Get chores done right away.' },
  { itemCode: 'ipip-bfm50-s05', displayOrder: 24, domain: 'emotionalStability', keyed: '-', textJa: '動揺しやすい', textEnOriginal: 'Am easily disturbed.' },
  { itemCode: 'ipip-bfm50-i05', displayOrder: 25, domain: 'intellect', keyed: '+', textJa: '素晴らしいアイディアを持っている', textEnOriginal: 'Have excellent ideas.' },
  { itemCode: 'ipip-bfm50-e06', displayOrder: 26, domain: 'extraversion', keyed: '-', textJa: 'あまり話すことがない', textEnOriginal: 'Have little to say.' },
  { itemCode: 'ipip-bfm50-a06', displayOrder: 27, domain: 'agreeableness', keyed: '+', textJa: '優しい心を持っている', textEnOriginal: 'Have a soft heart.' },
  { itemCode: 'ipip-bfm50-c06', displayOrder: 28, domain: 'conscientiousness', keyed: '-', textJa: '整理整頓を怠りがち', textEnOriginal: 'Often forget to put things back in their proper place.' },
  { itemCode: 'ipip-bfm50-s06', displayOrder: 29, domain: 'emotionalStability', keyed: '-', textJa: '慌てやすい', textEnOriginal: 'Get upset easily.' },
  { itemCode: 'ipip-bfm50-i06', displayOrder: 30, domain: 'intellect', keyed: '-', textJa: 'アイディアが乏しいほうだ', textEnOriginal: 'Do not have a good imagination.' },
  { itemCode: 'ipip-bfm50-e07', displayOrder: 31, domain: 'extraversion', keyed: '+', textJa: 'パーティでは色々な人と話すほうだ', textEnOriginal: 'Talk to a lot of different people at parties.' },
  { itemCode: 'ipip-bfm50-a07', displayOrder: 32, domain: 'agreeableness', keyed: '-', textJa: '他人にはまったく興味がない', textEnOriginal: 'Am not really interested in others.' },
  { itemCode: 'ipip-bfm50-c07', displayOrder: 33, domain: 'conscientiousness', keyed: '+', textJa: '整頓するのが好きである', textEnOriginal: 'Like order.' },
  { itemCode: 'ipip-bfm50-s07', displayOrder: 34, domain: 'emotionalStability', keyed: '-', textJa: '気分をコロコロ変える', textEnOriginal: 'Change my mood a lot.' },
  { itemCode: 'ipip-bfm50-i07', displayOrder: 35, domain: 'intellect', keyed: '+', textJa: 'ものわかりが良いほうだ', textEnOriginal: 'Am quick to understand things.' },
  { itemCode: 'ipip-bfm50-e08', displayOrder: 36, domain: 'extraversion', keyed: '-', textJa: '人から注目を浴びるのは好きではない', textEnOriginal: "Don't like to draw attention to myself." },
  { itemCode: 'ipip-bfm50-a08', displayOrder: 37, domain: 'agreeableness', keyed: '+', textJa: '他の人のために時間を割くほうだ', textEnOriginal: 'Take time out for others.' },
  { itemCode: 'ipip-bfm50-c08', displayOrder: 38, domain: 'conscientiousness', keyed: '-', textJa: '仕事や学習をさぼることが多い', textEnOriginal: 'Shirk my duties.' },
  { itemCode: 'ipip-bfm50-s08', displayOrder: 39, domain: 'emotionalStability', keyed: '-', textJa: '気分が著しく変化するほうだ', textEnOriginal: 'Have frequent mood swings.' },
  { itemCode: 'ipip-bfm50-i08', displayOrder: 40, domain: 'intellect', keyed: '+', textJa: '難しい言葉を使うほうだ', textEnOriginal: 'Use difficult words.' },
  { itemCode: 'ipip-bfm50-e09', displayOrder: 41, domain: 'extraversion', keyed: '+', textJa: '注目の的になるのは嫌ではない', textEnOriginal: "Don't mind being the center of attention." },
  { itemCode: 'ipip-bfm50-a09', displayOrder: 42, domain: 'agreeableness', keyed: '+', textJa: '他の人の気持ちがわかる', textEnOriginal: "Feel others' emotions." },
  { itemCode: 'ipip-bfm50-c09', displayOrder: 43, domain: 'conscientiousness', keyed: '+', textJa: '予定に従うほうだ', textEnOriginal: 'Follow a schedule.' },
  { itemCode: 'ipip-bfm50-s09', displayOrder: 44, domain: 'emotionalStability', keyed: '-', textJa: 'イライラしやすい', textEnOriginal: 'Get irritated easily.' },
  { itemCode: 'ipip-bfm50-i09', displayOrder: 45, domain: 'intellect', keyed: '+', textJa: 'いろんなことを反省しては時間を過ごす', textEnOriginal: 'Spend time reflecting on things.' },
  { itemCode: 'ipip-bfm50-e10', displayOrder: 46, domain: 'extraversion', keyed: '-', textJa: '人見知りする', textEnOriginal: 'Am quiet around strangers.' },
  { itemCode: 'ipip-bfm50-a10', displayOrder: 47, domain: 'agreeableness', keyed: '+', textJa: '人を安心させる', textEnOriginal: 'Make people feel at ease.' },
  { itemCode: 'ipip-bfm50-c10', displayOrder: 48, domain: 'conscientiousness', keyed: '+', textJa: '張り切って仕事や学習に取り組むほうだ', textEnOriginal: 'Am exacting in my work.' },
  { itemCode: 'ipip-bfm50-s10', displayOrder: 49, domain: 'emotionalStability', keyed: '-', textJa: '落ち込むことが多い', textEnOriginal: 'Often feel blue.' },
  { itemCode: 'ipip-bfm50-i10', displayOrder: 50, domain: 'intellect', keyed: '+', textJa: 'アイディアが豊富である', textEnOriginal: 'Am full of ideas.' },
]

export const IPIP_BFM_50_JA: ScaleDefinition = {
  scaleCode: 'ipip-bfm-50-ja',
  scaleVersion: '1.0.0',
  name: 'IPIP Lexical Big-Five Factor Markers 日本語版（50項目）',
  sourceUrl: 'https://ipip.ori.org/JapaneseBig-FiveFactorMarkers.htm',
  scoringKeyUrl: 'https://ipip.ori.org/newBigFive5broadKey.htm',
  license: 'IPIP: public domain（商用・非商用を問わず利用可。https://ipip.ori.org/newPermission.htm）',
  licenseVerifiedAt: '2026-07-04',
  validationReference:
    'Apple, M. T., & Neff, P. (2012). Using Rasch measurement to validate the Big Five factor marker questionnaire for a Japanese university population. Journal of Applied Measurement, 13, 1-21.',
  items: ITEMS,
}

/** 出題順（displayOrder 昇順）の項目一覧 */
export function getItemsInDisplayOrder(): ScaleItem[] {
  return [...IPIP_BFM_50_JA.items].sort((a, b) => a.displayOrder - b.displayOrder)
}

/** itemCode から項目を引く（存在しない場合 undefined） */
export function findScaleItem(itemCode: string): ScaleItem | undefined {
  return IPIP_BFM_50_JA.items.find((item) => item.itemCode === itemCode)
}
