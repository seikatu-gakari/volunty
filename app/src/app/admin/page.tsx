import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClipboardCheck,
  Handshake,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent } from "@/app/components/ui/Card";
import { fetchDashboardStats } from "@/lib/admin/actions";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface SummaryCard {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
}

export default async function AdminDashboardPage() {
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

  const stats = await fetchDashboardStats();
  const cards: SummaryCard[] = [
    {
      label: "ユーザー数",
      value: stats.userCount,
      icon: Users,
    },
    {
      label: "マッチング数",
      value: stats.matchingCount,
      icon: Handshake,
    },
    {
      label: "審査待ち件数",
      value: stats.pendingReviewCount,
      icon: ClipboardCheck,
      href: "/admin/organizations",
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <LayoutDashboard className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-dark">
              管理ダッシュボード
            </h1>
            <p className="text-sm text-text-body">サービス全体のサマリ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <DashboardSummaryCard key={card.label} card={card} />
          ))}
        </div>

        <nav className="mt-8 flex flex-col gap-2">
          <Link
            href="/admin/organizations"
            className="flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-3 text-sm font-medium text-text-dark transition-colors hover:bg-background"
          >
            <ClipboardCheck className="size-4 text-primary" />
            団体審査一覧
          </Link>
        </nav>
      </main>
    </div>
  );
}

function DashboardSummaryCard({ card }: { card: SummaryCard }) {
  const Icon = card.icon;
  const content = (
    <Card
      className={`h-full ${card.href ? "transition-opacity hover:opacity-80" : ""}`}
    >
      <CardContent className="gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <p className="text-sm text-text-body">{card.label}</p>
        <p className="text-3xl font-bold text-text-dark">
          {card.value.toLocaleString("ja-JP")}
        </p>
      </CardContent>
    </Card>
  );

  if (card.href) {
    return (
      <Link href={card.href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
