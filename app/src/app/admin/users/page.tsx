import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Header } from "@/app/components/Header";
import { getViewerContext } from "@/lib/auth/viewer-context";
import {
  fetchPendingAccountDeletionQueries,
  fetchUsersQuery,
} from "@/lib/admin/queries";
import { AdminUserList } from "./AdminUserList";
import { PendingAccountDeletions } from "./PendingAccountDeletions";

export default async function AdminUsersPage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive || viewer.role !== "admin") {
    redirect("/forbidden");
  }

  const [users, pendingDeletions] = await Promise.all([
    fetchUsersQuery(),
    fetchPendingAccountDeletionQueries(),
  ]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />
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

        <PendingAccountDeletions requests={pendingDeletions} />
        <AdminUserList users={users} />
      </main>
    </div>
  );
}
