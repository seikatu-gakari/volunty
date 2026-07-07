import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";

const LINK_GROUPS = [
  {
    heading: "サービス",
    links: [
      { label: "性格傾向チェック", href: "/diagnosis" },
      { label: "活動を探す", href: "/opportunities" },
      { label: "団体の方へ", href: "/signup" },
    ],
  },
  {
    heading: "サポート",
    links: [
      { label: "使い方ガイド", href: "#usage" },
      { label: "よくある質問", href: "#faq" },
    ],
  },
];

export function LPFooter() {
  return (
    <footer className="relative z-10 mt-20 border-t border-card-border pb-10 pt-12">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
            あなたにぴったりのボランティアが見つかる。
          </p>
        </div>

        {LINK_GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="mb-3 text-sm font-bold text-text-dark">{group.heading}</p>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-xs text-text-body transition-colors hover:text-text-dark"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-card-border pt-6 sm:flex-row">
        <p className="text-xs text-text-body">© 2025 Volunty. All rights reserved.</p>
      </div>
    </footer>
  );
}
