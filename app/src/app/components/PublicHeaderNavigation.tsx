"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { MobileMenuButton } from "@/app/components/MobileMenuButton";

const MOBILE_LINKS = [
  { href: "#kadai", label: "はじめられない理由" },
  { href: "#usage", label: "使い方" },
  { href: "#types", label: "活動スタイル" },
  { href: "#faq", label: "よくある質問" },
] as const;

export function PublicHeaderNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <a
        href="#waitlist"
        className="hidden h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-dark lg:inline-flex"
      >
        <Mail className="size-4" aria-hidden />
        無料で事前登録
      </a>

      <MobileMenuButton
        menuOpen={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="lg:hidden"
      />

      {menuOpen && (
        <div className="absolute top-full right-0 left-auto mt-2 max-h-[calc(100dvh-5rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl border border-card-border bg-background p-3 shadow-xl lg:hidden">
          <nav aria-label="モバイルナビゲーション" className="grid gap-1">
            {MOBILE_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-text-dark transition-colors hover:bg-primary/5 hover:text-text-dark"
              >
                {item.label}
              </a>
            ))}
            <a
              href="#waitlist"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
            >
              無料で事前登録
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}
