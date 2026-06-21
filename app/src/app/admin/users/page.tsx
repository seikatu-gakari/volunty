import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Header } from "@/app/components/Header";
import { fetchUsers } from "@/lib/admin/actions";
import { AdminUserList } from "./AdminUserList";

export default async function AdminUsersPage() {
  // 管理者チェック
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "admin") {
    redirect("/forbidden");
  }

  const users = await fetchUsers();

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-dark">
              ユーザー一覧
            </h1>
            <p className="text-sm text-text-body">
              登録ユーザーの検索・確認を行います
            </p>
          </div>
        </div>

        <AdminUserList users={users} />
      </main>
    </div>
  );
}
