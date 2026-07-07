import type { ReactNode } from "react";
import { Heart } from "lucide-react";

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
    <div className="mb-12 text-center">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
        <Heart className="size-3.5 fill-primary/25" strokeWidth={1.5} aria-hidden />
        {eyebrow}
        <Heart className="size-3.5 fill-primary/25" strokeWidth={1.5} aria-hidden />
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-text-body">
          {description}
        </p>
      )}
    </div>
  );
}
