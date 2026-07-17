import type { ReactNode } from "react";

interface LPSectionHeadingProps {
  /** 見出し上の小ラベル */
  eyebrow: string;
  /** セクション見出し */
  title: ReactNode;
  /** 見出し下の補足説明（省略可） */
  description?: ReactNode;
}

/** LP各セクション共通の見出しブロック */
export function LPSectionHeading({ eyebrow, title, description }: LPSectionHeadingProps) {
  return (
    <div className="mb-10 text-left sm:mb-12">
      <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.14em] text-primary-dark">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-black leading-tight tracking-tight text-text-dark sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 max-w-2xl text-sm leading-7 text-text-body sm:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
