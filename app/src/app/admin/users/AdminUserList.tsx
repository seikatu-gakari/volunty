"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Mail,
  MapPin,
  Search,
  Shield,
  User,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import type { AdminUserListItem } from "@/lib/admin/actions";
import { UserSuspensionControl } from "./UserSuspensionControl";

interface Props {
  users: AdminUserListItem[];
}

type RoleFilter = AdminUserListItem["role"] | "all";

interface RoleView {
  icon: LucideIcon;
  label: string;
  avatarClass: string;
  badgeClass: string;
}

const roleViews: Record<AdminUserListItem["role"], RoleView> = {
  participant: {
    icon: User,
    label: "参加者",
    avatarClass: "bg-primary/10 text-primary",
    badgeClass: "border-primary/20 bg-primary/5 text-primary",
  },
  organization: {
    icon: Building2,
    label: "団体",
    avatarClass: "bg-background text-text-dark",
    badgeClass: "border-card-border bg-background text-text-dark",
  },
  admin: {
    icon: Shield,
    label: "管理者",
    avatarClass: "bg-primary/15 text-primary-dark",
    badgeClass: "border-primary/30 bg-primary/10 text-primary-dark",
  },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP");
}

function getRoleCount(
  users: AdminUserListItem[],
  role: AdminUserListItem["role"]
) {
  return users.filter((user) => user.role === role).length;
}

export function AdminUserList({ users }: Props) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<RoleFilter>("all");

  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredUsers = users.filter((user) => {
    const matchesRole = activeTab === "all" || user.role === activeTab;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      user.displayName.toLocaleLowerCase().includes(normalizedQuery) ||
      (user.email?.toLocaleLowerCase().includes(normalizedQuery) ?? false);

    return matchesRole && matchesQuery;
  });

  const tabs: { key: RoleFilter; label: string; count: number }[] = [
    { key: "all", label: "すべて", count: users.length },
    { key: "participant", label: "参加者", count: getRoleCount(users, "participant") },
    { key: "organization", label: "団体", count: getRoleCount(users, "organization") },
    { key: "admin", label: "管理者", count: getRoleCount(users, "admin") },
  ];

  const emptyMessage =
    normalizedQuery.length > 0
      ? "条件に一致するユーザーはありません"
      : activeTab === "participant"
        ? "参加者は登録されていません"
        : activeTab === "organization"
          ? "団体は登録されていません"
          : activeTab === "admin"
            ? "管理者は登録されていません"
            : "登録ユーザーはありません";

  return (
    <div className="flex flex-col gap-6">
      <Input
        id="admin-user-search"
        label="検索"
        icon={Search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="名前またはメールで検索"
      />

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-tab-bg p-1 sm:grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-text-dark shadow-sm"
                : "text-text-body hover:text-text-dark"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                activeTab === tab.key
                  ? "bg-primary/10 text-primary"
                  : "bg-white/60 text-text-body"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Users className="size-10 text-text-body/30" />
          <p className="text-sm text-text-body">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredUsers.map((user) => {
            const roleView = roleViews[user.role];
            const RoleIcon = roleView.icon;

            return (
              <Card key={user.id}>
                <CardContent className="gap-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${roleView.avatarClass}`}
                        aria-label={`${user.displayName}のアバター`}
                        style={
                          user.avatarUrl
                            ? {
                                backgroundImage: `url("${user.avatarUrl}")`,
                                backgroundPosition: "center",
                                backgroundSize: "cover",
                              }
                            : undefined
                        }
                      >
                        {!user.avatarUrl && <RoleIcon className="size-5" />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words text-base font-bold text-text-dark">
                          {user.displayName}
                        </h2>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-text-body">
                          <Mail className="size-4 shrink-0 text-text-body/60" />
                          <span className="break-all">
                            {user.email ?? "メール未設定"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${roleView.badgeClass}`}
                      >
                        <RoleIcon className="size-3.5" />
                        {roleView.label}
                      </span>
                      {!user.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-card-border bg-background px-2.5 py-1 text-xs font-medium text-text-body">
                          <XCircle className="size-3.5" />
                          停止中
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm text-text-body sm:grid-cols-2">
                    {user.role === "participant" && user.region && (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-text-body/60" />
                        <span>地域: {user.region}</span>
                      </div>
                    )}
                    {user.role === "organization" && (
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="size-4 shrink-0 text-text-body/60" />
                        <span>
                          {user.organizationVerified
                            ? "認証済み"
                            : "未認証"}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 shrink-0 text-text-body/60" />
                      <span>登録日: {formatDate(user.createdAt)}</span>
                    </div>
                  </div>

                  <UserSuspensionControl user={user} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
