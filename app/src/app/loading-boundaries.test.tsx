/// <reference types="vite/client" />

import { render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

type LoadingModule = {
  default: ComponentType;
};

const loadingModules = import.meta.glob<LoadingModule>("./**/loading.tsx");

type LoadingBoundaryExpectation = {
  modulePath: string;
  title: string;
  variant: "dashboard" | "detail" | "form" | "list";
};

const loadingBoundaries: LoadingBoundaryExpectation[] = [
  { modulePath: "./loading.tsx", title: "トップページ", variant: "dashboard" },
  {
    modulePath: "./opportunities/loading.tsx",
    title: "活動を探す",
    variant: "list",
  },
  {
    modulePath: "./opportunities/[id]/loading.tsx",
    title: "活動詳細",
    variant: "detail",
  },
  {
    modulePath: "./diagnosis/loading.tsx",
    title: "性格傾向チェック",
    variant: "form",
  },
  {
    modulePath: "./organizations/loading.tsx",
    title: "団体情報",
    variant: "list",
  },
  {
    modulePath: "./organizations/[id]/loading.tsx",
    title: "団体詳細",
    variant: "detail",
  },
  { modulePath: "./(auth)/loading.tsx", title: "認証", variant: "form" },
  {
    modulePath: "./onboarding/loading.tsx",
    title: "プロフィール設定",
    variant: "form",
  },
];

describe("主要ルートのLoading boundary", () => {
  it.each(loadingBoundaries)(
    "$modulePath は $title 用の $variant スケルトンを表示する",
    async ({ modulePath, title, variant }) => {
      const loadBoundary = loadingModules[modulePath];

      expect(loadBoundary).toBeDefined();
      if (!loadBoundary) {
        return;
      }

      const { default: LoadingBoundary } = await loadBoundary();
      render(<LoadingBoundary />);

      const status = screen.getByRole("status", {
        name: `${title}を読み込み中`,
      });
      expect(status.getAttribute("aria-busy")).toBe("true");

      if (variant === "form") {
        expect(
          within(status).getByRole("group", {
            name: `${title}の入力項目を読み込み中`,
          }),
        ).toBeDefined();
      }

      if (variant === "detail") {
        expect(
          within(status).getByLabelText(`${title}の詳細を読み込み中`),
        ).toBeDefined();
      }

      if (variant === "dashboard" || variant === "list") {
        expect(
          within(status).getByRole("list", {
            name: `${title}の読み込み項目`,
          }),
        ).toBeDefined();
      }
    },
  );
});
