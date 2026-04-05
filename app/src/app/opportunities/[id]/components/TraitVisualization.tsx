import type { BIG5Scores } from "@/lib/personality/types";

/** BIG5特性の日本語ラベル */
const traitLabels: Record<keyof BIG5Scores, string> = {
  extraversion: "外向性",
  agreeableness: "協調性",
  conscientiousness: "誠実性",
  neuroticism: "神経症傾向",
  openness: "開放性",
};

interface TraitVisualizationProps {
  requiredTraits: Record<string, number>;
}

/**
 * 求める性格特性の可視化コンポーネント
 *
 * BIG5 の各特性をバーチャートで表示する。
 */
export function TraitVisualization({
  requiredTraits,
}: TraitVisualizationProps) {
  const traitKeys = Object.keys(traitLabels) as (keyof BIG5Scores)[];
  const specifiedTraits = traitKeys.filter(
    (key) => typeof requiredTraits[key] === "number"
  );

  if (specifiedTraits.length === 0) {
    return (
      <p className="text-sm text-text-body">特性の指定はありません</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {specifiedTraits.map((trait) => {
        const value = requiredTraits[trait] as number;
        return (
          <div key={trait} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-dark">
                {traitLabels[trait]}
              </span>
              <span className="text-sm text-text-body">{value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
