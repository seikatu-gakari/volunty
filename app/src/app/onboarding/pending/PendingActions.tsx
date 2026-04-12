"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function PendingActions() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
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
