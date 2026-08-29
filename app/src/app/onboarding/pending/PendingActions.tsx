"use client";

import { LogOut } from "lucide-react";

export function PendingActions() {
  const handleLogout = () => {
    window.location.assign("/auth/signout");
  };

  return (
    <button
      onClick={handleLogout}
      className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary hover:bg-primary/5"
    >
      <LogOut className="size-4" />
      ログアウト
    </button>
  );
}
