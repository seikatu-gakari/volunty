import type { Big5Domain } from '@/lib/diagnosis-scale/types'

/**
 * 活動スタイルタグ。
 *
 * 団体が「求める人物像の数値」を入力する方式（旧 requirementTraits）を廃止し、
 * 活動内容を表すタグを案件へ最大3つ設定する方式に置き換える。
 * 各タグは BIG5 ドメインの高低方向にマップされ、参加者のスコアが同方向の
 * 場合のみ加点する（逆方向でも減点・除外はしない）。
 */
export interface ActivityStyleTag {
  id: string
  /** 団体・参加者向けの表示ラベル */
  label: string
  domain: Big5Domain
  direction: 'high' | 'low'
  /** 推薦理由に使う傾向説明（断定・適性保証の表現を使わない） */
  reasonText: string
}

export const ACTIVITY_STYLE_TAGS: ActivityStyleTag[] = [
  {
    id: 'talk-with-new-people',
    label: '初対面の人と多く話す',
    domain: 'extraversion',
    direction: 'high',
    reasonText: '初対面の人と話す場面が多い活動で、あなたの外向的な傾向が活きやすい内容です',
  },
  {
    id: 'solo-focused-work',
    label: '一人で集中する作業が中心',
    domain: 'extraversion',
    direction: 'low',
    reasonText: '一人で集中して取り組む活動で、じっくり向き合うあなたの傾向が活きやすい内容です',
  },
  {
    id: 'empathy-support',
    label: '相手に寄り添う支援が中心',
    domain: 'agreeableness',
    direction: 'high',
    reasonText: '相手に寄り添う場面が多い活動で、あなたの協調的な傾向が活きやすい内容です',
  },
  {
    id: 'precise-scheduled-work',
    label: '正確さや計画どおりの進行が重要',
    domain: 'conscientiousness',
    direction: 'high',
    reasonText: '正確さや計画性が求められる活動で、あなたの誠実な傾向が活きやすい内容です',
  },
  {
    id: 'calm-under-change',
    label: '状況変化への落ち着いた対応が必要',
    domain: 'emotionalStability',
    direction: 'high',
    reasonText: '状況が変わりやすい活動で、あなたの落ち着いた傾向が活きやすい内容です',
  },
  {
    id: 'creative-ideas',
    label: '新しいアイデアや工夫を歓迎',
    domain: 'intellect',
    direction: 'high',
    reasonText: 'アイデアや工夫が歓迎される活動で、あなたの発想を広げる傾向が活きやすい内容です',
  },
  {
    id: 'routine-steady-work',
    label: '決まった手順の安定した活動',
    domain: 'intellect',
    direction: 'low',
    reasonText: '決まった手順で安定して進める活動で、着実に取り組むあなたの傾向が活きやすい内容です',
  },
]

export function findActivityStyleTag(id: string): ActivityStyleTag | undefined {
  return ACTIVITY_STYLE_TAGS.find((tag) => tag.id === id)
}

/** 未知の値から有効なタグIDのみを抽出する（DB JSONB の検証用） */
export function toActivityStyleTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && ACTIVITY_STYLE_TAGS.some((tag) => tag.id === item)
  )
}
