import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";

export function LPFooter() {
  return (
    <footer className="relative z-10 mt-20 border-t border-card-border pb-10 pt-12">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link href="/" className="mb-4 flex items-center gap-2">
            <div className="relative">
              <Heart className="size-7 text-primary" fill="#fb5b01" strokeWidth={0} />
              <Sparkles className="absolute -top-1 -right-1 size-3 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-text-dark">Volunty</span>
              <span className="text-xs text-text-body">ボランティー</span>
            </div>
          </Link>
          <p className="text-xs leading-6 text-text-body">
            つながる、みつかる、変わっていく。<br />
            AIが見つける、あなたにぴったりなボランティア。
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-text-dark">サービス</p>
          <ul className="space-y-2">
            {["性格診断について", "活動を探す", "団体の方へ"].map((label) => (
              <li key={label}>
                <Link href="#" className="text-xs text-text-body transition-colors hover:text-text-dark">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-text-dark">サポート</p>
          <ul className="space-y-2">
            {["使い方ガイド", "よくある質問", "お問い合わせ"].map((label) => (
              <li key={label}>
                <Link href="#" className="text-xs text-text-body transition-colors hover:text-text-dark">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-text-dark">運営</p>
          <ul className="space-y-2">
            {["運営会社", "プライバシーポリシー", "利用規約"].map((label) => (
              <li key={label}>
                <Link href="#" className="text-xs text-text-body transition-colors hover:text-text-dark">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-card-border pt-6 sm:flex-row">
        <p className="text-xs text-text-body">© 2025 Volunty. All rights reserved.</p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary-dark">
          <span>📱</span> 「東京アプリ」連携予定
        </p>
      </div>
    </footer>
  );
}
