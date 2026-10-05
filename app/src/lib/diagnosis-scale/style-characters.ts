import type { ActivityStyleId } from "@/lib/diagnosis-scale/types";

/** 活動スタイルを親しみやすく伝える表示用キャラクター。採点・分類には使わない。 */
export interface StyleCharacter {
  name: string;
  strength: string;
  imagePath: string;
}

export const STYLE_CHARACTERS: Readonly<Record<ActivityStyleId, StyleCharacter>> = {
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
  return Object.hasOwn(STYLE_CHARACTERS, id) ? STYLE_CHARACTERS[id as ActivityStyleId] : undefined;
}
