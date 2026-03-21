"use client";

import { useState, type ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends Omit<ComponentProps<"input">, "size"> {
  label: string;
  icon?: LucideIcon;
  /** パスワード入力時の表示/非表示トグルを有効にする */
  showPasswordToggle?: boolean;
}

export function Input({
  label,
  icon: Icon,
  showPasswordToggle = false,
  type = "text",
  className = "",
  id,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const inputId = id ?? label;
  const inputType = showPasswordToggle
    ? showPassword
      ? "text"
      : "password"
    : type;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-text-dark"
      >
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-body" />
        )}
        <input
          id={inputId}
          type={inputType}
          className={`h-10 w-full rounded-lg border border-input-border bg-white py-2 pr-3 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30 ${Icon ? "pl-10" : "pl-3"} ${showPasswordToggle ? "pr-10" : ""} ${className}`}
          {...props}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-body hover:text-text-dark"
            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
