---
name: volunty-directory-structure
description: 'Use when: Volunty のファイル配置、Next.js App Router のルート、lib 配下のドメインロジック、コンポーネント配置、探索先を確認する必要がある。'
argument-hint: '例: 新しいページの配置先 / ドメインロジックの場所 / 関連ファイルを探したい'
---

# ディレクトリ構造

```text
app/src/
├── app/                      # App Router
│   ├── globals.css           # Tailwind CSS 4 + CSS変数
│   ├── components/           # 共有UIコンポーネント
│   ├── diagnosis/components/ # 診断UI（すべて "use client"）
│   └── [route]/page.tsx      # onboarding / dashboard / mypage / opportunities ...
└── lib/
    ├── personality/          # types.ts / constants.ts / logic.ts / machine.ts
    ├── supabase/             # client.ts / server.ts / middleware.ts
    └── [domain]/             # actions.ts（Server Actions）+ *.test.ts
```

## 配置ルール

- ページ: `app/src/app/<route>/page.tsx`
- 共通 UI: `app/src/app/components/`
- ドメインロジック: `app/src/lib/<domain>/`
- Server Actions: `app/src/lib/<domain>/actions.ts`
- ドメインロジックのテスト: 実装ファイルと同じディレクトリの `*.test.ts` / `*.test.tsx`
- Supabase 関連: `app/src/lib/supabase/`

## 探索時の目安

- 画面から探す場合は `app/src/app/` から見る。
- DB・認可・保存処理は `app/src/lib/**/actions.ts` と [app/prisma/schema.prisma](../../../app/prisma/schema.prisma) を確認する。
- BIG5 診断は `app/src/lib/personality/` と `app/src/app/diagnosis/` を確認する。