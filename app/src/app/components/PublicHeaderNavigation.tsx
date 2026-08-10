"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, Menu, UserPlus, X } from "lucide-react";

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
      <Link
        href="/login"
        className="hidden h-10 items-center gap-2 rounded-xl border border-card-border bg-white px-3 text-sm font-bold text-text-dark transition-colors hover:border-primary/40 hover:text-text-dark lg:inline-flex"
      >
        <LogIn className="hidden size-4 sm:block" aria-hidden />
        ログイン
      </Link>

      <Link
        href="/signup"
        className="hidden h-10 items-center gap-2 rounded-xl bg-primary-dark px-4 text-sm font-bold text-white transition-colors hover:bg-text-dark lg:inline-flex"
      >
        <UserPlus className="size-4" aria-hidden />
        無料で始める
      </Link>

      <button
        type="button"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
        onClick={() => setMenuOpen((open) => !open)}
        className="inline-flex size-12 items-center justify-center rounded-xl border border-card-border bg-white text-text-dark transition-colors hover:bg-primary/5 lg:hidden"
      >
        {menuOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>

      {menuOpen && (
        <div className="absolute top-full right-0 left-auto mt-2 w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-card-border bg-background p-3 shadow-xl lg:hidden">
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
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-card-border bg-white px-4 text-sm font-bold text-text-dark transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <LogIn className="size-4" aria-hidden />
              ログイン
            </Link>
            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-primary-dark px-4 text-sm font-bold text-white transition-colors hover:bg-text-dark"
            >
              無料で始める
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
