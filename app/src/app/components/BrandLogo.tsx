import { Heart, Sparkles } from "lucide-react";

/** アプリ全体で使用する公式ブランドロゴ。 */
export function BrandLogo() {
  return (
    <span className="flex items-center gap-2">
      <span className="relative shrink-0">
        <Heart
          className="size-8 text-primary"
          fill="currentColor"
          strokeWidth={0}
          data-testid="brand-heart"
          aria-hidden="true"
        />
        <Sparkles
          className="absolute -top-1 -right-1 size-3.5 text-primary"
          data-testid="brand-sparkles"
          aria-hidden="true"
        />
      </span>
      <span className="text-lg font-medium leading-7 whitespace-nowrap text-text-dark">
        ボランティ
      </span>
    </span>
  );
}
