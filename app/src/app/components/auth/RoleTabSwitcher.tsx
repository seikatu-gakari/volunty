"use client";

import { Users, Building2 } from "lucide-react";

export type AuthRole = "participant" | "organization";

interface RoleTabSwitcherProps {
  role: AuthRole;
  onRoleChange: (role: AuthRole) => void;
}

export function RoleTabSwitcher({ role, onRoleChange }: RoleTabSwitcherProps) {
  return (
    <div className="flex h-10 items-center rounded-lg bg-tab-bg p-1">
      <TabButton
        active={role === "participant"}
        onClick={() => onRoleChange("participant")}
        icon={<Users className="size-4" />}
        label="応募者"
      />
      <TabButton
        active={role === "organization"}
        onClick={() => onRoleChange("organization")}
        icon={<Building2 className="size-4" />}
        label="団体"
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-background text-text-dark shadow-sm"
          : "text-text-body hover:text-text-dark"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
