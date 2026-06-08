---
name: volunty-coding-conventions
description: 'Use when: Volunty の実装規約、型安全、use client、インポート、状態管理、Tailwind、テスト、ファイル配置ルールを確認する必要がある。'
argument-hint: '例: 実装規約を確認 / 新しいコンポーネントを書く / テスト配置を確認'
---

# コーディング規約

| 項目 | ルール |
| --- | --- |
| `"use client"` | イベント・`useState`・ブラウザ API を使う場合のみ |
| 型安全 | `any` 禁止。`unknown` + 型ガードを使う。ドメイン型は `app/src/lib/<domain>/types.ts` に集約 |
| インポート | `@/` エイリアス必須。深い相対パス（`../../..`）禁止 |
| 状態管理 | グローバル → XState / ローカル → `useState` / `useMemo`・`useCallback` 不要（React Compiler） |
| スタイリング | Tailwind ユーティリティクラスのみ。カラーハードコード禁止（`bg-primary` などを使用） |
| テスト | ドメインロジックには必ずユニットテスト。同ディレクトリに `.test.ts` / `.test.tsx` を配置 |
| コミット | Conventional Commits（`feat:` `fix:` `docs:` など）。説明は日本語 |
| ファイル配置 | ページ: `app/src/app/<route>/page.tsx` / 共通 UI: `app/src/app/components/` / ロジック: `app/src/lib/<domain>/` |

## 実装時の注意

- 既存パターンに合わせ、不要なリファクタリングや再フォーマットを避ける。
- 公開 API や型を変更する場合は影響範囲を確認する。
- ドメインロジックを追加・変更した場合はテストを追加または更新する。