# Super MVP 開発設計書

## 1. アーキテクチャ概要

2週間でのリリースを最優先するため、フロントエンド・バックエンド・インフラを最小構成で構築し、複雑な機能要件や状態管理を削ぎ落とす。

### 1.1 技術スタック
- **Frontend / Backend**: Next.js (App Router, React 19)
- **Database / Auth**: Supabase (PostgreSQL, Google OAuth)
- **Styling**: Tailwind CSS v4
- **State Management (Diagnosis)**: XState v5
- **Hosting**: Vercel

### 1.2 全体構成
- `app/` 配下でルーティングとAPI (Route Handlers / Server Actions) を実装
- 状態管理は、性格診断フローなど複雑な遷移が必要な箇所のみ XState を用い、その他は React の標準フックと Server Actions で完結させる
- データベースは Supabase に依存し、管理者機能（団体の審査やユーザー凍結など）は Supabase Dashboard から直接操作してUI実装を省略する

---

## 2. 画面構成・サイトマップ (Site Map)

最短リリースに向け、画面遷移を最小限に抑えたツリー構成：

```text
volunty.app
│
├── / ............................ トップ / LP
├── /login ....................... ログイン（OAuth）
│
├── /onboarding/ ................. 登録・オンボーディング
│   ├── role ..................... ロール選択（参加者 or 団体）
│   ├── participant .............. 参加者プロフィール登録
│   ├── organization ............. 団体プロフィール登録
│   └── pending .................. 審査待ち画面（団体用）
│
├── /diagnosis/ .................. 参加者：診断機能
│   ├── (index) .................. 診断画面（簡易16問・詳細60問の質問ウィザード / `mode=brief|full` 対応）
│   └── result ................... 診断結果表示（10類型 ＋ BIG5スコア）
│
├── /recommendations ............. 参加者：おすすめ案件一覧（マッチングスコア順）
│                                  ※カテゴリ・地域フィルタUI付き（クエリパラメータで制御）
│
├── /organizations/ .............. 共通：団体詳細
│   └── :id ...................... 団体情報・活動内容・他の募集案件一覧（/opportunities/:id からリンク）
│
├── /opportunities/ .............. 共通：案件詳細
│   └── :id ...................... 募集案件詳細（団体名・活動概要・相性スコア表示 / 応募ボタン / 団体詳細へのリンク）
│
├── /mypage/ ..................... 参加者：マイページ
│   └── (index) .................. 自分のプロフィール ＋ 応募進捗・成立時の相手情報表示
│
└── /dashboard/ .................. 団体：ダッシュボード
    ├── (index) .................. 作成した募集案件の一覧
    └── opportunities/ ........... 団体の案件管理
        ├── new .................. 募集案件の作成
        └── :id/
            ├── (index) .......... 応募者一覧（マッチングスコア順・承認/辞退ボタン付き）
            ├── applicants/
            │   └── :applicationId .. 応募者詳細（診断タイプ・BIG5スコア・応募メッセージ確認）
            └── edit ............. 募集案件の編集
```

---

## 3. データベース設計（主要テーブル案）

MVP最少構成のためのスキーマ。アプローチや証明書関連のテーブルを削除/統合済み。

### `users` (Supabase Auth と連携)
- `id`: UUID (PK)
- `email`: String (Unique)
- `role`: Enum ('participant', 'organization')
- `created_at`: Timestamp

### `participants` (参加者プロフィール)
- `id`: UUID (PK, users.id)
- `name`: String
- `region`: String (希望地域)
- `diagnosis_type`: String (10類型の結果)
- `diagnosis_scores`: JSONB (BIG5スコア詳細)

### `organizations` (団体プロフィール)
- `id`: UUID (PK, users.id)
- `name`: String
- `description`: Text
- `line_id`: String (マッチング時開示用)
- `contact_email`: String
- `status`: Enum ('pending', 'approved', 'rejected') - 管理者が操作

### `opportunities` (募集案件)
- `id`: UUID (PK)
- `organization_id`: UUID (FK)
- `title`: String
- `description`: Text
- `required_traits`: JSONB (求める性格特性のスコア条件など)
- `status`: Enum ('open', 'closed')

### `applications` (応募トランザクション)
- `id`: UUID (PK)
- `opportunity_id`: UUID (FK)
- `participant_id`: UUID (FK)
- `message`: Text (応募メッセージ)
- `status`: Enum ('pending', 'approved', 'rejected')
- `created_at`: Timestamp

---

## 3. API・サーバーアクション設計

Supabaseクエリを利用するServer Actionsを主要エンドポイントとして実装する。

### 参加者向け(Participant Actions)
- `registerParticipant(data)`: プロフィール登録
- `submitDiagnosis(answers)`: 診断結果の計算・保存
- `fetchRecommendations(filters?)`: 案件一覧取得（性格スコア順ソート。`category`・`region` のクエリフィルタ対応）
- `applyToOpportunity(id, message)`: 案件への応募
- `fetchMyApplications()`: 応募状況と相手のLINE ID（ステータスが approved の場合のみ）の取得

### 団体向け(Organization Actions)
- `registerOrganization(data)`: 団体登録
- `createOpportunity(data)` / `updateOpportunity(id, data)`: 案件管理
- `fetchMyOpportunities()`: 自団体の案件一覧取得
- `fetchApplicantsForOpportunity(opportunity_id)`: 応募者一覧取得（マッチングスコア付き）
- `fetchApplicantDetail(application_id)`: 応募者詳細取得（診断タイプ・BIG5スコア・応募メッセージ）
- `updateApplicationStatus(id, new_status)`: 応募者の承認/辞退操作

---

## 4. 認証・認可フロー

- **共通（初回ログイン）:**
  - OAuth コールバック後、`users.role` が未設定（NULL）の場合は `/onboarding/role` へリダイレクト
  - ロール選択完了後、参加者は `/onboarding/participant`、団体は `/onboarding/organization` へ遷移
- **参加者 (Participant):**
  - 未ログイン時は `/login` へリダイレクト
  - `participants` レコード未作成時は `/onboarding/participant` へリダイレクト
- **団体 (Organization):**
  - `organizations` レコード未作成時は `/onboarding/organization` へリダイレクト
  - `organizations.status` が `'approved'` でない場合は `/onboarding/pending` 以外へのアクセスをブロックする
- **RSCでのチェック**: 
  - Layout / Page 単位で `supabase.auth.getUser()` を呼び出し、Roleに基づくミドルウェア的なアクセス制限を実装
  - ロール判定順: ① `users.role` が NULL → `/onboarding/role`、② ロール別プロフィール未作成 → 各オンボーディングページ、③ 団体の審査ステータス確認

---

## 5. 開発フェーズとマイルストーン (2週間)

### Week 1: コア機能と基盤（認証・診断）
- **Day 1-2**: Supabaseプロジェクトのセットアップ、DBスキーマ構築、Google OAuthログイン実装
- **Day 3-4**: 参加者・団体の基本プロフィール登録画面・APIの実装
- **Day 5-7**: XStateを用いた性格診断（簡易16問・詳細60問）のUIフロー実装と、スコアリング処理・結果保存の実装

### Week 2: マッチングトランザクションと仕上げ
- **Day 8-9**: 団体側の募集案件作成・管理、および応募状況（応募者）確認画面の実装
- **Day 10-11**: 参加者側のおすすめ案件一覧、詳細から「応募する」機能の実装
- **Day 12**: 応募の「承認/辞退」アクションと、マッチング成立時のLINE ID開示（マイページ実装）
- **Day 13-14**: 総合テスト（Vercelへのデプロイ）、手動での団体審査フロー動作確認、バグ修正

---

## 6. 実装順序戦略

### 6.1 方針: 基盤→縦スライス

UI を全部先に作る／API を全部先に作る、いずれの水平分割も採用しない。

- **UI先行のリスク**: 仮データで構築すると実際の DB 構造との乖離で手戻りが発生する
- **API先行のリスク**: 動く画面がないため検証が遅れ、UI 接続時に設計ミスが発覚する

**最適解は「共通基盤を固めた後、画面と API をセットで機能単位（縦スライス）に開発する」** こと。
各フェーズの完了時点で動作するサブセットが得られ、インクリメンタルにテスト・検証できる。

### 6.2 実装済み機能（着手前の現状）

| ステータス | 機能                                                 | 備考                                |
| :--------: | ---------------------------------------------------- | ----------------------------------- |
|     ✅      | BIG5 性格診断エンジン（簡易16問・詳細60問 + XState） | P-3, P-4 テスト済み                 |
|     ✅      | 診断結果表示（10類型 + BIG5スコア）                  | ResultView                          |
|     ✅      | トップページ（LP）                                   | Server Component                    |
|     ✅      | ログイン / サインアップ UI                           | Google OAuth ボタン含む             |
|     ✅      | Supabase クライアント / サーバー設定                 | client.ts, server.ts, middleware.ts |
|     ✅      | UI コンポーネント基盤                                | Button, Card, Input, ProgressBar 等 |

### 6.3 フェーズ別実装計画

#### フェーズ 0: 基盤（全機能の前提条件）

> **目的**: DB・認証・ルーティング保護を整備し、以降の全フェーズが動作する土台を作る。

| #   | タスク                   | 種別 | 成果物                                                                                            |
| --- | ------------------------ | ---- | ------------------------------------------------------------------------------------------------- |
| 0-1 | Supabase DB スキーマ構築 | DB   | `users`, `participants`, `organizations`, `opportunities`, `applications` テーブル + RLS ポリシー |
| 0-2 | OAuth コールバック実装   | API  | `/auth/callback/route.ts`（認証後の `users` レコード作成含む）                                    |
| 0-3 | ロールベースミドルウェア | Auth | 未認証→`/login`、未登録→`/onboarding` へのリダイレクト制御                                        |

**完了条件**: Google ログイン → `users` テーブルにレコード作成 → ロールに応じたリダイレクトが動作する。

---

#### フェーズ 1: 参加者フロー（縦スライス）

> **目的**: アプリのコアバリュー（診断→マッチング→応募）を一気通貫で実装する。

| #   | タスク                                                  | 種別               | 成果物                                                                                              |
| --- | ------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| 1-1 | オンボーディング（ロール選択 → 参加者プロフィール登録） | UI + Server Action | `/onboarding/role`, `/onboarding/participant` + `registerParticipant()`                             |
| 1-2 | 既存診断の DB 保存接続                                  | Server Action      | `submitDiagnosis()` — 計算結果を `participants.diagnosis_type` / `diagnosis_scores` に保存          |
| 1-3 | おすすめ案件一覧 + フィルタ                             | UI + Server Action | `/recommendations` + `fetchRecommendations(filters?)` — スコア距離順ソート・カテゴリ/地域フィルタUI |
| 1-4 | 案件詳細 + 応募                                         | UI + Server Action | `/opportunities/:id` + `applyToOpportunity()` — 団体情報表示・団体詳細へのリンク含む                |
| 1-5 | 団体詳細                                                | UI                 | `/organizations/:id` — 団体情報・他の募集案件一覧（参照のみ、読み取り専用）                         |

**完了条件**: 参加者がログイン→プロフィール登録→診断→おすすめ案件閲覧→応募、の一連フローが動作する。

> **備考**: フェーズ 1 のテスト時は団体・案件データをシードデータとして投入する。

---

#### フェーズ 2: 団体フロー（縦スライス）

> **目的**: 団体側の案件管理と応募者管理を実装し、双方向のマッチングフローを完成させる。

| #   | タスク                              | 種別               | 成果物                                                                                                                                                     |
| --- | ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2-1 | 団体オンボーディング + 審査待ち画面 | UI + Server Action | `/onboarding/organization`, `/onboarding/pending` + `registerOrganization()`                                                                               |
| 2-2 | ダッシュボード + 案件 CRUD          | UI + Server Action | `/dashboard`, `/dashboard/opportunities/new`, `/dashboard/opportunities/:id/edit` + `createOpportunity()`, `updateOpportunity()`, `fetchMyOpportunities()` |
| 2-3 | 応募者一覧（承認 / 辞退）           | UI + Server Action | `/dashboard/opportunities/:id` + `fetchApplicantsForOpportunity()`, `updateApplicationStatus()` — スコア順一覧・インライン承認/辞退                        |
| 2-4 | 応募者詳細                          | UI + Server Action | `/dashboard/opportunities/:id/applicants/:applicationId` + `fetchApplicantDetail()` — 診断タイプ・BIG5スコア・応募メッセージ確認                           |

**完了条件**: 団体がログイン→登録→案件作成→応募者確認→承認/辞退、の一連フローが動作する。

---

#### フェーズ 3: 横断機能 + 仕上げ

> **目的**: 両フロー統合後の横断的な機能実装と品質担保。

| #   | タスク                     | 種別               | 成果物                                                                |
| --- | -------------------------- | ------------------ | --------------------------------------------------------------------- |
| 3-1 | マイページ                 | UI + Server Action | `/mypage` + `fetchMyApplications()` — 応募進捗・成立時の LINE ID 表示 |
| 3-2 | 総合テスト + バグ修正      | QA                 | 全フロー結合テスト、エッジケース対応                                  |
| 3-3 | Vercel デプロイ + 動作確認 | Infra              | 本番環境での手動団体審査フロー含む動作確認                            |

**完了条件**: 参加者・団体の両フローが本番環境で正常に動作し、マッチング成立→連絡先開示まで完結する。

### 6.4 依存関係図

```text
フェーズ 0（基盤: DB + Auth + Middleware）
    │
    ├──→ フェーズ 1（参加者フロー）
    │        │
    │        └──→ フェーズ 3（横断機能 + 仕上げ）
    │                  ↑
    └──→ フェーズ 2（団体フロー）──┘
```

- フェーズ 0 は全フェーズの前提条件（最優先で着手）
- フェーズ 1・2 はフェーズ 0 完了後に着手可能（並行開発も可）
- フェーズ 3 はフェーズ 1・2 の両方が完了してから着手

---

## 7. スコープ外（Phase 2以降へ見送り）
- 管理専用UIの構築（団体の審査は Supabase Dashboard から `organizations.status` を手動変更する）
- 参加者リストからのスカウト・アプローチ機能
- 参加証明書の発行履歴管理
- レコメンドアルゴリズムの複雑化（初期は単純なJSONB内のスコア間距離差分など）
- メッセージチャット機能等の独自実装（LINEに誘導して完結させるため）
