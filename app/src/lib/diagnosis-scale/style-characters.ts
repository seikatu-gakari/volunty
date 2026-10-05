import type { LegacyActivityStyleId } from "@/lib/diagnosis-scale/types";

/** 活動スタイルを親しみやすく伝える表示用キャラクター。採点・分類には使わない。 */
export interface StyleCharacter {
  name: string;
  strength: string;
  imagePath: string;
}

export const STYLE_CHARACTERS: Readonly<Record<LegacyActivityStyleId, StyleCharacter>> = {
  "innovator-leader": {
    name: "ひらめきキツネ",
    strength: "ひらめきで、新しい一歩をつくる",
    imagePath: "/images/diagnosis/characters/innovator-leader.png",
  },
  "supporter-care": {
    name: "よりそいクマ",
    strength: "そっと寄り添い、安心を届ける",
    imagePath: "/images/diagnosis/characters/supporter-care.png",
  },
  "creative-solo": {
    name: "つくりてネコ",
    strength: "じっくり深めて、アイデアを形にする",
    imagePath: "/images/diagnosis/characters/creative-solo.png",
  },
  "perfectionist-analyst": {
    name: "ていねいフクロウ",
    strength: "小さな気づきで、確かさを支える",
    imagePath: "/images/diagnosis/characters/perfectionist-analyst.png",
  },
  "charisma-entertainer": {
    name: "えがおイルカ",
    strength: "楽しい空気で、みんなを笑顔にする",
    imagePath: "/images/diagnosis/characters/charisma-entertainer.png",
  },
  "strategist-planner": {
    name: "だんどりビーバー",
    strength: "先を見すえて、一歩ずつ進める",
    imagePath: "/images/diagnosis/characters/strategist-planner.png",
  },
  "harmony-mediator": {
    name: "つなぎてカワウソ",
    strength: "人と人をつなぎ、協力の輪を広げる",
    imagePath: "/images/diagnosis/characters/harmony-mediator.png",
  },
  "adventure-explorer": {
    name: "ぼうけんツバメ",
    strength: "好奇心を翼に、新しい場所へ向かう",
    imagePath: "/images/diagnosis/characters/adventure-explorer.png",
  },
  "conservative-guardian": {
    name: "みまもりイヌ",
    strength: "日々の積み重ねで、安心を守る",
    imagePath: "/images/diagnosis/characters/conservative-guardian.png",
  },
  "sensitive-artist": {
    name: "いろどりシカ",
    strength: "繊細な感性で、思いを表現する",
    imagePath: "/images/diagnosis/characters/sensitive-artist.png",
  },
};

/** 未知のタイプは従来のタイプ名だけで表示する。 */
export function findStyleCharacter(id: string): StyleCharacter | undefined {
  return Object.hasOwn(STYLE_CHARACTERS, id) ? STYLE_CHARACTERS[id as LegacyActivityStyleId] : undefined;
}

/** v2専用の装飾。旧タイプの意味・名称は引き継がず、画像だけを再利用する。 */
export const DIRECTION_CHARACTERS = {
  "e-high": { name: "交流のイルカ", imagePath: STYLE_CHARACTERS["charisma-entertainer"].imagePath },
  "e-low": { name: "静かな関わりのネコ", imagePath: STYLE_CHARACTERS["creative-solo"].imagePath },
  "a-high": { name: "調和のクマ", imagePath: STYLE_CHARACTERS["supporter-care"].imagePath },
  "a-low": { name: "自分の立場重視のキツネ", imagePath: STYLE_CHARACTERS["innovator-leader"].imagePath },
  "c-high": { name: "計画・秩序のビーバー", imagePath: STYLE_CHARACTERS["strategist-planner"].imagePath },
  "c-low": { name: "計画・秩序へのこだわり弱めのカワウソ", imagePath: STYLE_CHARACTERS["harmony-mediator"].imagePath },
  "s-high": { name: "穏やかな反応のイヌ", imagePath: STYLE_CHARACTERS["conservative-guardian"].imagePath },
  "s-low": { name: "反応が出やすいシカ", imagePath: STYLE_CHARACTERS["sensitive-artist"].imagePath },
  "i-high": { name: "新しい発想のツバメ", imagePath: STYLE_CHARACTERS["adventure-explorer"].imagePath },
  "i-low": { name: "慣れた方法のフクロウ", imagePath: STYLE_CHARACTERS["perfectionist-analyst"].imagePath },
} as const;

/** 方向IDだけを受け取る。中立・混合から代表の動物を選ばない。 */
export function findDirectionCharacter(id: string) {
  return Object.hasOwn(DIRECTION_CHARACTERS, id)
    ? DIRECTION_CHARACTERS[id as keyof typeof DIRECTION_CHARACTERS]
    : undefined;
}
