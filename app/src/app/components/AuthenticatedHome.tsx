import Link from "next/link";
import {
  BadgeCheck,
  Brain,
  Building2,
  FileCheck2,
  Heart,
  History,
  Inbox,
  LayoutDashboard,
  MessageSquarePlus,
  Plus,
  Search,
  Sparkles,
  User as UserIcon,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export type AuthenticatedHomeRole = "participant" | "organization" | "admin" | null;

interface AuthenticatedHomeProps {
  user: User;
  role: AuthenticatedHomeRole;
  onboardingCompleted: boolean;
  organizationVerified?: boolean;
}

interface FeatureLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  primary?: boolean;
}

interface HomeDashboardContent {
  title: string;
  description: string;
  links: FeatureLink[];
}

const PARTICIPANT_LINKS: FeatureLink[] = [
  {
    href: "/mypage",
    label: "マイページ",
    description: "プロフィール、応募状況、参加証明書をまとめて確認します。",
    icon: UserIcon,
    primary: true,
  },
  {
    href: "/recommendations",
    label: "おすすめ案件",
    description: "興味や地域に合うボランティア募集を探します。",
    icon: Search,
  },
  {
    href: "/diagnosis",
    label: "性格傾向チェック",
    description: "活動スタイルの参考になる診断を受けます。",
    icon: Brain,
  },
  {
    href: "/mypage/approaches",
    label: "受信アプローチ",
    description: "団体から届いたアプローチを確認します。",
    icon: Inbox,
  },
  {
    href: "/mypage/certificates",
    label: "参加証明書",
    description: "活動完了後の証明書申請と発行状況を確認します。",
    icon: FileCheck2,
  },
];

const ORGANIZATION_LINKS: FeatureLink[] = [
  {
    href: "/dashboard",
    label: "ダッシュボード",
    description: "募集案件と団体の状態を確認します。",
    icon: LayoutDashboard,
    primary: true,
  },
  {
    href: "/dashboard/opportunities/new",
    label: "新しい案件を作成",
    description: "参加者を募集するボランティア案件を登録します。",
    icon: Plus,
  },
  {
    href: "/dashboard/participants",
    label: "おすすめ参加者",
    description: "募集内容に合う参加者候補を確認します。",
    icon: Users,
  },
  {
    href: "/dashboard/approaches",
    label: "アプローチ履歴",
    description: "参加者へ送ったアプローチの履歴を確認します。",
    icon: MessageSquarePlus,
  },
  {
    href: "/dashboard/certificates",
    label: "証明書申請",
    description: "参加証明書の申請内容を確認し発行します。",
    icon: FileCheck2,
  },
];

const ADMIN_LINKS: FeatureLink[] = [
  {
    href: "/admin",
    label: "管理ダッシュボード",
    description: "ユーザー数、マッチング数、審査待ち件数を確認します。",
    icon: LayoutDashboard,
    primary: true,
  },
  {
    href: "/admin/organizations",
    label: "団体審査一覧",
    description: "登録団体の審査と承認状況を管理します。",
    icon: BadgeCheck,
  },
  {
    href: "/admin/users",
    label: "ユーザー管理",
    description: "利用者の状態確認と凍結管理を行います。",
    icon: Users,
  },
  {
    href: "/admin/reviews/history",
    label: "審査履歴",
    description: "団体審査の対応履歴を確認します。",
    icon: History,
  },
];

function getDashboardContent({
  role,
  onboardingCompleted,
  organizationVerified,
}: Pick<
  AuthenticatedHomeProps,
  "role" | "onboardingCompleted" | "organizationVerified"
>): HomeDashboardContent {
  if (role === "admin") {
    return {
      title: "管理者メニュー",
      description: "運営管理で使う機能へ移動できます。",
      links: ADMIN_LINKS,
    };
  }

  if (role === "organization") {
    if (!onboardingCompleted) {
      return {
        title: "団体登録を完了してください",
        description: "募集機能を使うには、団体プロフィールの登録が必要です。",
        links: [
          {
            href: "/onboarding/organization",
            label: "団体プロフィールを登録",
            description: "団体情報を入力して審査へ進みます。",
            icon: Building2,
            primary: true,
          },
        ],
      };
    }

    if (!organizationVerified) {
      return {
        title: "団体審査の状況",
        description: "審査完了までは募集機能の利用が制限されます。",
        links: [
          {
            href: "/onboarding/pending",
            label: "審査状況を確認",
            description: "団体プロフィールの審査状態を確認します。",
            icon: BadgeCheck,
            primary: true,
          },
        ],
      };
    }

    return {
      title: "募集団体メニュー",
      description: "募集、参加者確認、証明書発行の機能へ移動できます。",
      links: ORGANIZATION_LINKS,
    };
  }

  if (role === "participant") {
    if (!onboardingCompleted) {
      return {
        title: "応募者登録を完了してください",
        description: "応募機能を使うには、参加者プロフィールの登録が必要です。",
        links: [
          {
            href: "/onboarding/participant",
            label: "参加者プロフィールを登録",
            description: "希望地域などを入力して利用を開始します。",
            icon: UserIcon,
            primary: true,
          },
        ],
      };
    }

    return {
      title: "応募者メニュー",
      description: "応募者として使える機能へ移動できます。",
      links: PARTICIPANT_LINKS,
    };
  }

  return {
    title: "利用を開始してください",
    description: "アカウント種別を選ぶと、使える機能が表示されます。",
    links: [
      {
        href: "/onboarding/role",
        label: "アカウント種別を選択",
        description: "応募者または募集団体として利用を開始します。",
        icon: UserIcon,
        primary: true,
      },
    ],
  };
}

export function AuthenticatedHome({
  user,
  role,
  onboardingCompleted,
  organizationVerified = false,
}: AuthenticatedHomeProps) {
  const displayName =
    user.user_metadata?.full_name ?? user.email ?? "ゲスト";
  const dashboardContent = getDashboardContent({
    role,
    onboardingCompleted,
    organizationVerified,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 pt-6">
      {/* ウェルカムセクション */}
      <section className="flex flex-col items-center gap-6 py-12">
        <div className="relative">
          <Heart
            className="size-16 text-primary"
            fill="#fb5b01"
            strokeWidth={0}
          />
          <Sparkles className="absolute -top-2 -right-1 size-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-base text-text-body">おかえりなさい</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-text-dark">
            {displayName}さん
          </h1>
        </div>
        <p className="max-w-md text-center text-base leading-7 text-text-body">
          あなたの興味や傾向に合ったボランティア活動を見つけましょう
        </p>
      </section>

      <section className="flex flex-col gap-4 py-6">
        <div>
          <h2 className="text-lg font-bold text-text-dark">
            {dashboardContent.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-body">
            {dashboardContent.description}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dashboardContent.links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex min-h-28 items-start gap-3 rounded-[10px] border p-4 shadow-sm transition-shadow hover:shadow-md ${
                item.primary
                  ? "border-primary/30 bg-primary/5"
                  : "border-card-border bg-white"
              }`}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <item.icon className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-dark group-hover:text-primary">
                  {item.label}
                </h3>
                <p className="mt-1 text-sm leading-5 text-text-body">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 利用の流れ */}
      <section className="flex flex-col items-center gap-8 py-12">
        <h2 className="text-base text-text-dark">利用の流れ</h2>
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              step: 1,
              color: "bg-primary",
              title: "性格傾向チェック",
              description:
                "簡易診断（15問）または全50問の質問で、5つの性格特性の傾向を確認します",
            },
            {
              step: 2,
              color: "bg-primary-dark",
              title: "マッチング",
              description:
                "興味分野・地域・日程などをもとに、性格の傾向も参考にしておすすめを表示します",
            },
            {
              step: 3,
              color: "bg-text-dark",
              title: "参加申し込み",
              description:
                "気になる活動があれば、詳細を確認して参加申し込みができます",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div
                className={`flex size-12 items-center justify-center rounded-full ${item.color} text-base font-medium text-white`}
              >
                {item.step}
              </div>
              <h3 className="text-base text-text-dark">{item.title}</h3>
              <p className="text-sm leading-5 text-text-body">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
