/// <reference types="vite/client" />

import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const loadingModules = import.meta.glob<{ default: ComponentType }>("./**/loading.tsx");

// ルート固有の接続だけを確認し、共通UIの詳細はLoadingSkeletonのUTに集約する。
const loadingBoundaries = [
  ["./loading.tsx", "トップページ"],
  ["./opportunities/loading.tsx", "活動を探す"],
  ["./opportunities/[id]/loading.tsx", "活動詳細"],
  ["./diagnosis/loading.tsx", "性格傾向チェック"],
  ["./organizations/loading.tsx", "団体情報"],
  ["./organizations/[id]/loading.tsx", "団体詳細"],
  ["./(auth)/loading.tsx", "認証"],
  ["./onboarding/loading.tsx", "プロフィール設定"],
] as const;

describe("主要ルートのLoading boundary", () => {
  it.each(loadingBoundaries)(
    "%s は %s の読み込み状態を表示する",
    async (modulePath, title) => {
      const loadBoundary = loadingModules[modulePath];
      expect(loadBoundary, modulePath).toBeDefined();
      const { default: LoadingBoundary } = await loadBoundary();
      render(<LoadingBoundary />);
      expect(screen.getByRole("status", { name: `${title}を読み込み中` })).toBeDefined();
    },
  );
});
