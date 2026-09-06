---
name: volunty-tech-stack
description: "Voluntyの採用技術・バージョン・重要設定を確認するときに使う。"
argument-hint: '例: 技術スタックを確認 / Next.jsの構成を確認 / テスト環境を確認'
---

# 技術スタック

| 技術 | バージョン・補足 |
| --- | --- |
| Next.js (App Router) | 16 / standalone 出力 / React Compiler 有効 |
| React / TypeScript | 19 / 5 / strict mode |
| Tailwind CSS / XState | 4 / 5（@xstate/react 6） |
| Supabase Auth | @supabase/ssr + @supabase/supabase-js |
| Prisma + pg | PostgreSQL via Session Pooler |
| Vitest | happy-dom + @testing-library/react |
| Vercel / Docker Compose | デプロイ（standalone）/ 開発環境 |

## 重要設定

- パスエイリアス: `@/*` → `app/src/*`
- ESLint: Flat Config（[eslint.config.mjs](../../../app/eslint.config.mjs)）
- フォント: Noto Sans JP

## 関連ファイル

- [app/package.json](../../../app/package.json)
- [app/next.config.ts](../../../app/next.config.ts)
- [app/tsconfig.json](../../../app/tsconfig.json)
- [app/vitest.config.mts](../../../app/vitest.config.mts)
- [app/prisma/schema.prisma](../../../app/prisma/schema.prisma)
