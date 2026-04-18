"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LogIn,
  LogOut,
  UserPlus,
  ClipboardList,
  Star,
  User,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { HeaderUserState } from "@/app/components/Header";

/** ナビリンク定義 */
interface NavItem {
  href: string;
  label: string;
  icon: typeof ClipboardList;
}

/** 参加者向けナビリンク */
const PARTICIPANT_NAV: NavItem[] = [
  { href: "/diagnosis", label: "診断", icon: ClipboardList },
  { href: "/recommendations", label: "おすすめ案件", icon: Star },
  { href: "/mypage", label: "マイページ2", icon: User },
];

/** 団体向けナビリンク */
const ORGANIZATION_NAV: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
];

export function HeaderAuth({
  user,
  userState,
}: {
  user: SupabaseUser | null;
  userState: HeaderUserState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  /** リンクがアクティブかどうか */
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  // --- ログイン済み ---
  if (user) {
    // オンボーディング完了済みのみナビリンクを表示
    const navItems =
      userState.onboardingCompleted && userState.role === "participant"
        ? PARTICIPANT_NAV
        : userState.onboardingCompleted &&
          userState.role === "organization" &&
          userState.verified
          ? ORGANIZATION_NAV
          : [];

    return (
      <div className="flex items-center gap-1" ref={menuRef}>
        {/* PC版ナビリンク */}
        {navItems.length > 0 && (
          <nav className="mr-2 hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-text-body hover:bg-primary/5 hover:text-primary"
                  }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {/* PC版ユーザー情報・ログアウト */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-text-body">
            {user.user_metadata?.full_name ?? user.email}
          </span>
          <button
            onClick={handleLogout}
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary hover:bg-primary/5"
          >
            <LogOut className="size-4" />
            ログアウト
          </button>
        </div>

        {/* モバイル: ハンバーガーボタン */}
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex size-10 items-center justify-center rounded-lg text-text-body hover:bg-primary/5 md:hidden"
          aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        {/* モバイル: ドロップダウンメニュー */}
        {menuOpen && (
          <div className="absolute top-full right-4 mt-1 w-56 rounded-xl border border-card-border bg-background shadow-lg md:hidden">
            {/* ユーザー名 */}
            <div className="border-b border-card-border px-4 py-3">
              <p className="truncate text-sm font-medium text-text-dark">
                {user.user_metadata?.full_name ?? user.email}
              </p>
            </div>

            {/* ナビリンク */}
            {navItems.length > 0 && (
              <nav className="border-b border-card-border py-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isActive(item.href)
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-text-body hover:bg-primary/5"
                      }`}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}

            {/* ログアウト */}
            <div className="py-1">
              <button
                onClick={() => { closeMenu(); handleLogout(); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-primary/5"
              >
                <LogOut className="size-4" />
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 未ログイン ---
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary hover:bg-primary/5"
      >
        <LogIn className="size-4" />
        ログイン
      </Link>
      <Link
        href="/signup"
        className="flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark"
      >
        <UserPlus className="size-4" />
        新規登録
      </Link>
    </div>
  );
}
