---
name: super-mvp-implementation-audit
description: 'Use when: Volunty の Super MVP 実装状況、MVP進捗、設計書との差分、未実装機能、コードベース監査を判定する。docs/design/super-mvp-design.md を基準に、実コード・DB・Server Actions・ルート・テストから証拠付きステータスを作成する。'
argument-hint: '例: フェーズ1の実装状況を判定 / Super MVP全体を監査 / 未実装タスクを優先度順に出して'
---

# Super MVP 実装状況監査

Volunty の [docs/design/super-mvp-design.md](../../../docs/design/super-mvp-design.md) に定義された Super MVP が、現在のコードベースでどこまで実装済みかを判定するためのスキル。

## 成果物

次のいずれか、または組み合わせを出力する。

- フェーズ別の実装状況表
- 機能別の `✅ 実装済み` / `🟡 部分実装` / `❌ 未実装` / `⚠️ 要確認` 判定
- 設計書との差分と不足実装リスト
- 次に着手すべきタスクの優先順位
- 判定根拠となるコード・スキーマ・テストへのリンク

## 必ず守る判定原則

1. **設計書は基準、コードベースが証拠**
   - [docs/design/super-mvp-design.md](../../../docs/design/super-mvp-design.md) は要求仕様として読む。
   - 「実装済み」の証拠は、実際のコード・スキーマ・テスト・設定ファイルから示す。
   - [docs/quality/status.md](../../../docs/quality/status.md) や [specs/features.json](../../../specs/features.json) は補助情報であり、単独で実装済み判定しない。

2. **画面だけでは実装済みにしない**
   - UI、Server Action / Route Handler、DBスキーマ、認可、エラーハンドリング、テストのうち、MVP成立に必要な要素を確認する。
   - 仮データ・モック・ハードコードだけの場合は `🟡 部分実装` または `❌ 未実装` とする。

3. **リンク付き証拠を付ける**
   - 回答では、根拠ファイルを必ずワークスペース相対のMarkdownリンクで示す。
   - 具体的な関数・ルート・テーブル・テストに言及する場合は、可能な範囲で行リンクを付ける。

4. **日本語で簡潔にまとめる**
   - UIテキスト・説明・判定コメントは日本語。
   - ただし、コード上のシンボル名は原文のまま `registerParticipant()` のように示す。

## 判定ステータス

| ステータス | 条件 |
| --- | --- |
| `✅ 実装済み` | 設計書の機能要件を満たす実装があり、DB/API/UI/認可など必要要素が接続済み。主要な正常系が動作すると判断できる。 |
| `🟡 部分実装` | 一部のUI・関数・スキーマはあるが、DB接続、保存、認可、画面遷移、テストなどに不足がある。 |
| `❌ 未実装` | 対応するルート・関数・スキーマ・処理が見つからない、またはプレースホルダーのみ。 |
| `⚠️ 要確認` | 実装の存在は確認できるが、環境変数・外部サービス・RLS・手動操作など実行確認なしでは判断しきれない。 |

## 監査手順

### 1. 基準資料を読む

最初に以下を確認する。

1. [docs/design/super-mvp-design.md](../../../docs/design/super-mvp-design.md)
2. [.github/copilot-instructions.md](../../copilot-instructions.md)
3. 必要に応じて [CLAUDE.md](../../../CLAUDE.md)、[specs/features.json](../../../specs/features.json)、[docs/quality/status.md](../../../docs/quality/status.md)

### 2. 実装面を領域別に探索する

以下の観点で、ファイル検索・文字列検索・シンボル検索を行う。

| 領域 | 主な確認先 | 見るもの |
| --- | --- | --- |
| ルーティング | `app/src/app/**/page.tsx`, `layout.tsx`, `route.ts` | 設計書のURLが存在するか、リダイレクト・認可があるか |
| Server Actions | `app/src/lib/**/actions.ts` | 設計書のAction名相当の関数、DB更新、入力検証、認可 |
| DB / Prisma | `app/prisma/schema.prisma`, `app/prisma/migrations/**`, `supabase/migrations/**` | テーブル、Enum、リレーション、制約、RLS相当 |
| Supabase Auth | `app/src/lib/supabase/**`, `app/src/proxy.ts`, `app/src/app/auth/**` | OAuth callback、ユーザー取得、Cookie処理、保護ルート |
| UIコンポーネント | `app/src/app/**`, `app/src/app/components/**` | フォーム、ボタン、フィルタ、結果表示、応募・承認操作 |
| ドメインロジック | `app/src/lib/personality/**`, `app/src/lib/recommendations/**` | BIG5計算、タイプ判定、マッチングスコア |
| テスト | `app/src/**/*.test.ts`, `app/src/**/*.test.tsx` | 主要ロジック・Actionsのテスト有無 |

### 3. Super MVP チェックリストで照合する

詳細な観点は [references/super-mvp-checklist.md](./references/super-mvp-checklist.md) を使う。

基本単位は次のフェーズ。

1. フェーズ0: DB + Auth + Middleware
2. フェーズ1: 参加者フロー
3. フェーズ2: 団体フロー
4. フェーズ3: 横断機能 + 仕上げ

### 4. 証拠を分類する

各項目について、以下を分けて記録する。

- **存在確認**: ルート・関数・テーブル・コンポーネントがある
- **接続確認**: UIからActionが呼ばれる / ActionがDBに保存する / 認可チェックがある
- **品質確認**: 型安全、エラー処理、テスト、設計書との命名・データ構造整合性
- **未確認事項**: 外部サービス設定、環境変数、Supabase Dashboard手動操作、実行しないと分からない挙動

### 5. 必要なら検証コマンドを実行する

コード読解で不足する場合のみ、プロジェクト標準コマンドで検証する。

- `cd app && npm run lint`
- `cd app && npm run test`
- `cd app && npm run build`

ローカル出力削減が必要なら `rtk` を利用してよい。

## 出力テンプレート

```markdown
## Super MVP 実装状況

総合判定: 🟡 部分実装

| フェーズ | 判定 | 根拠 | 主な不足 |
| --- | --- | --- | --- |
| フェーズ0: 基盤 | 🟡 | [schema.prisma](app/prisma/schema.prisma), [callback](app/src/app/auth/callback/route.ts) | RLS確認、OAuth実環境確認 |

## 機能別詳細

### フェーズ1: 参加者フロー
- `registerParticipant()`: ✅ 実装済み — 根拠: ...
- `submitDiagnosis()`: 🟡 部分実装 — 保存先はあるが... 

## 次にやること
1. ...
2. ...
```

## 完了チェック

回答前に確認する。

- [ ] [docs/design/super-mvp-design.md](../../../docs/design/super-mvp-design.md) を基準にした
- [ ] 実装済み判定にはコードベース上の証拠を付けた
- [ ] UIだけ、設計書だけ、READMEだけで実装済み判定していない
- [ ] フェーズ0〜3の少なくとも対象範囲を明示した
- [ ] 不足実装を次アクションに落とし込んだ
- [ ] ファイル参照はMarkdownリンク形式にした
