import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { Header } from "@/app/components/Header";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { fetchOrganizationById } from "@/lib/admin/actions";
import { OrganizationReviewDetail } from "./OrganizationReviewDetail";

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const organization = await fetchOrganizationById(id);

  if (!organization) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/admin/reviews"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          団体審査一覧へ戻る
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-dark">
              団体審査詳細
            </h1>
            <p className="text-sm text-text-body">
              団体情報を確認して承認または否認を行います
            </p>
          </div>
        </div>

        <OrganizationReviewDetail organization={organization} />
      </main>
    </div>
  );
}
