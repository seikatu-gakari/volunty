"use client";

import { createClient } from "@/lib/supabase/client";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export function HeaderAuth({ user }: { user: User | null }) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-body">
          {user.user_metadata?.full_name ?? user.email}
        </span>
        <button
          onClick={handleLogout}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-primary hover:bg-primary/5"
        >
          <LogOut className="size-4" />
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-primary hover:bg-primary/5"
      >
        <LogIn className="size-4" />
        ログイン
      </Link>
      <Link
        href="/login"
        className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
      >
        <UserPlus className="size-4" />
        新規登録
      </Link>
    </div>
  );
}
