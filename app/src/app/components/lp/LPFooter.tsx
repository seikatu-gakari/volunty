import Image from "next/image";
import Link from "next/link";
import { lpAssets } from "./lpAssets";

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
] as const;

export function LPFooter() {
  return (
    <footer className="mt-20 border-t border-card-border py-12">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3" aria-label="ボランティー">
            <Image
              src={lpAssets.brandMark.src}
              alt={lpAssets.brandMark.alt}
              width={lpAssets.brandMark.width}
              height={lpAssets.brandMark.height}
              className="size-11 object-contain"
            />
            <span className="text-xl font-black tracking-tight text-text-dark">ボランティー</span>
          </Link>
          <p className="mt-4 text-sm leading-7 text-text-body">
            つながる、みつかる、変わっていく。<br />
            自分らしく続けられるボランティアとの出会いを。
          </p>
        </div>

        {LINK_GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="mb-4 text-sm font-black text-text-dark">{group.heading}</p>
            <ul className="space-y-3">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-text-body transition-colors hover:text-secondary-dark">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-card-border pt-6">
        <p className="text-xs text-text-body">© 2026 ボランティー. All rights reserved.</p>
      </div>
    </footer>
  );
}
