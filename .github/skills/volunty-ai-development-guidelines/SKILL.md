---
name: volunty-ai-development-guidelines
description: 'Use when: Volunty で AI エージェントが実装・修正・設計判断を行う前に、既存パターン、型安全、テスト、Server Components、設計書、Supabase、XState の注意事項を確認する必要がある。'
argument-hint: '例: 実装前の注意事項を確認 / 新機能を追加 / Supabase認証を触る / 複数ステップフローを作る'
---

# AI 開発時の注意事項

1. 既存パターン踏襲: 診断 UI・ロジック層の構造を参考に実装する。
2. 型安全: `any` 禁止。`unknown` + 型ガードを使う。ドメイン型は `types.ts` に集約する。
3. テスト必須: ドメインロジックにはユニットテストを同ディレクトリに配置する。
4. Server Component デフォルト: `"use client"` はインタラクティブ操作時のみ使う。
5. パスエイリアス: `@/` を使用し、深い相対パスは禁止する。
6. 設計書参照: 新機能実装前に `docs/` の該当設計書を確認する。
7. 日本語: UI テキスト・コメント・説明はすべて日本語にする。
8. カラー: CSS 変数ベースの Tailwind クラスを使用し、色のハードコードは禁止する。
9. XState: 複数ステップのフローは XState で実装する。
10. Supabase 認証: `@/lib/supabase/` 経由で扱い、直接 SDK 呼び出しを避ける。

## 関連 skill

- 実装規約の詳細: [volunty-coding-conventions](../volunty-coding-conventions/SKILL.md)
- アーキテクチャの詳細: [volunty-architecture-design](../volunty-architecture-design/SKILL.md)
- ドキュメント参照先: [volunty-document-map](../volunty-document-map/SKILL.md)