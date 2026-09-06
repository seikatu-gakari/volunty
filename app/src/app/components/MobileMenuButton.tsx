"use client";

import { Menu, X } from "lucide-react";

interface MobileMenuButtonProps {
  menuOpen: boolean;
  onClick: () => void;
  className: string;
}

/** ヘッダー共通のモバイルメニュートリガー。 */
export function MobileMenuButton({
  menuOpen,
  onClick,
  className,
}: MobileMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex size-10 items-center justify-center rounded-lg text-text-body transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
      aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
      aria-expanded={menuOpen}
    >
      {menuOpen ? (
        <X className="size-5" aria-hidden="true" />
      ) : (
        <Menu className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}
