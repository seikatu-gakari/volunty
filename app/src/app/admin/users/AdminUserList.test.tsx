import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminUserList } from "./AdminUserList";
import type { AdminUserListItem } from "@/lib/admin/actions";

vi.mock("@/lib/admin/actions", () => ({
  suspendUser: vi.fn(),
  reactivateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const users: AdminUserListItem[] = [
  {
    id: "participant-1",
    role: "participant",
    displayName: "参加者 太郎",
    email: "participant@example.com",
    avatarUrl: null,
    isActive: true,
    suspendedAt: null,
    suspendReason: null,
    region: "東京都",
    organizationVerified: null,
    lastLoginAt: "2026-06-19T10:00:00.000Z",
    createdAt: "2026-06-18T10:00:00.000Z",
  },
  {
    id: "organization-1",
    role: "organization",
    displayName: "テスト団体",
    email: "org@example.com",
    avatarUrl: null,
    isActive: false,
    suspendedAt: "2026-06-19T12:00:00.000Z",
    suspendReason: "規約違反のため",
    region: null,
    organizationVerified: true,
    lastLoginAt: null,
    createdAt: "2026-06-17T10:00:00.000Z",
  },
  {
    id: "admin-1",
    role: "admin",
    displayName: "管理者",
    email: "admin@example.com",
    avatarUrl: null,
    isActive: true,
    suspendedAt: null,
    suspendReason: null,
    region: null,
    organizationVerified: null,
    lastLoginAt: null,
    createdAt: "2026-06-16T10:00:00.000Z",
  },
];

describe("AdminUserList", () => {
  it("名前とメールでユーザーを検索できる", () => {
    render(<AdminUserList users={users} />);

    fireEvent.change(screen.getByLabelText("検索"), {
      target: { value: "ORG@" },
    });

    expect(screen.getByText("テスト団体")).toBeDefined();
    expect(screen.queryByText("参加者 太郎")).toBeNull();
    expect(screen.queryByText("admin@example.com")).toBeNull();
  });

  it("ロールタブで表示対象を絞り込める", () => {
    render(<AdminUserList users={users} />);

    fireEvent.click(screen.getByRole("button", { name: /団体\s+1/ }));

    expect(screen.getByText("テスト団体")).toBeDefined();
    expect(screen.queryByText("参加者 太郎")).toBeNull();
    expect(screen.queryByText("admin@example.com")).toBeNull();
  });

  it("参加者と団体には凍結/解除操作を表示し、管理者には表示しない", () => {
    render(<AdminUserList users={users} />);

    expect(screen.getByText("停止中")).toBeDefined();
    expect(screen.getByRole("button", { name: "凍結する" })).toBeDefined();
    expect(screen.getByRole("button", { name: "凍結を解除" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /管理者\s+1/ }));

    expect(screen.getByRole("heading", { name: "管理者" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "凍結する" })).toBeNull();
    expect(screen.queryByRole("button", { name: "凍結を解除" })).toBeNull();
  });
});
