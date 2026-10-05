import Image from "next/image";
import { findDirectionCharacter, findStyleCharacter } from "@/lib/diagnosis-scale/style-characters";
import type { ActivityStyleType } from "@/lib/diagnosis-scale/types";

/** 本診断・お試し診断で共有する、参考スタイルの紹介。 */
export function ActivityStyleHero({ styleType }: { styleType: ActivityStyleType }) {
  const legacyCharacter = findStyleCharacter(styleType.id);
  const singleDirection = styleType.classificationKind === "single" ? styleType.directions?.[0] : undefined;
  const character = legacyCharacter ?? (singleDirection ? findDirectionCharacter(singleDirection.id) : undefined);

  return (
    <div className="text-center">
      <p className="inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-text-dark">
        あなたに近い活動スタイル（参考）
      </p>
      {character && (
        <div className="mx-auto my-4 flex size-48 items-center justify-center rounded-full bg-primary/5 sm:size-56">
          <Image
            src={character.imagePath}
            alt=""
            width={256}
            height={256}
            sizes="(min-width: 640px) 224px, 192px"
            className="size-full object-contain"
          />
        </div>
      )}
      <h2 className="mt-4 break-words text-3xl font-extrabold leading-tight text-primary-dark sm:text-4xl">
        {character?.name ?? styleType.name}
      </h2>
      {character && (
        <>
          <p className="mt-3 text-base font-semibold leading-relaxed text-text-dark sm:text-lg">
            {legacyCharacter?.strength ?? singleDirection?.description}
          </p>
          <p className="mt-4 text-sm font-medium leading-relaxed text-text-body">
            {styleType.name}
          </p>
        </>
      )}
      <p className="mt-1 break-words text-xs text-text-body">{styleType.nameEn}</p>
      {styleType.classificationKind === "mixed" && (
        <ul aria-label="近い方向の一覧" className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {styleType.directions?.map((direction) => {
            const directionCharacter = findDirectionCharacter(direction.id);
            return (
              <li key={direction.id} className="min-w-0 break-words rounded-xl bg-primary/5 px-3 py-4 text-text-dark">
                {directionCharacter && <Image
                  src={directionCharacter.imagePath}
                  alt=""
                  width={128}
                  height={128}
                  sizes="128px"
                  className="mx-auto aspect-square w-full max-w-32 object-contain"
                />}
                <p className="mt-2 text-sm font-semibold leading-relaxed">{directionCharacter?.name ?? direction.name}</p>
                {directionCharacter && <p className="mt-2 text-xs leading-5 text-text-body">{direction.name}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mx-auto mt-4 max-w-lg text-xs leading-5 text-text-body">
        {legacyCharacter
          ? "キャラクターは活動スタイルを親しみやすく表すためのものです。性格を決めつけるものではなく、回答によって変わることがあります。"
          : "活動スタイルは5つの連続スコアを読みやすくするための補助ラベルで、科学的に確立した性格タイプではありません。性格を決めつけるものではなく、回答によって変わることがあります。"}
      </p>
      {!legacyCharacter && <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-text-body">
        動物は方向を親しみやすく示すためのイラストです。動物と性格に科学的な対応関係はなく、固定的なタイプや能力・適性を表すものではありません。
      </p>}
      {!legacyCharacter && <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-text-body">
        分類の境界は暫定的なものです。境界付近では小さな回答差で表示が変わります。特に15問版は1問の影響が大きいため、5つのスコアを合わせて確認してください。
      </p>}
    </div>
  );
}
