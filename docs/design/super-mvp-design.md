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

## 2. データベース設計（主要テーブル案）

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
- `fetchRecommendations()`: 案件一覧取得（性格スコア順ソート）
- `applyToOpportunity(id, message)`: 案件への応募
- `fetchMyApplications()`: 応募状況と相手のLINE ID（ステータスが approved の場合のみ）の取得

### 団体向け(Organization Actions)
- `registerOrganization(data)`: 団体登録
- `createOpportunity(data)` / `updateOpportunity(id, data)`: 案件管理
- `fetchMyOpportunities()`: 自団体の案件一覧取得
- `fetchApplicantsForOpportunity(opportunity_id)`: 応募者一覧取得
- `updateApplicationStatus(id, new_status)`: 応募者の承認/辞退操作

---

## 4. 認証・認可フロー

- **参加者 (Participant):**
  - 未ログイン時は `/login` へリダイレクト
  - プロフィール未登録時は `/onboarding/participant` へリダイレクト
- **団体 (Organization):**
  - プロフィール未登録時は `/onboarding/organization` へリダイレクト
  - status が 'approved' でない場合は `/onboarding/pending` 以外へのアクセスをブロックする
- **RSCでのチェック**: 
  - Layout / Page 単位で `supabase.auth.getUser()` を呼び出し、Roleに基づくミドルウェア的なアクセス制限を実装

---

## 5. 開発フェーズとマイルストーン (2週間)

### Week 1: コア機能と基盤（認証・診断）
- **Day 1-2**: Supabaseプロジェクトのセットアップ、DBスキーマ構築、Google OAuthログイン実装
- **Day 3-4**: 参加者・団体の基本プロフィール登録画面・APIの実装
- **Day 5-7**: XStateを用いた性格診断（50問）のUIフロー実装と、スコアリング処理・結果保存の実装

### Week 2: マッチングトランザクションと仕上げ
- **Day 8-9**: 団体側の募集案件作成・管理、および応募状況（応募者）確認画面の実装
- **Day 10-11**: 参加者側のおすすめ案件一覧、詳細から「応募する」機能の実装
- **Day 12**: 応募の「承認/辞退」アクションと、マッチング成立時のLINE ID開示（マイページ実装）
- **Day 13-14**: 総合テスト（Vercelへのデプロイ）、手動での団体審査フロー動作確認、バグ修正

---

## 6. スコープ外（Phase 2以降へ見送り）
- 管理専用UIの構築（団体の審査は Supabase Dashboard から `organizations.status` を手動変更する）
- 参加者リストからのスカウト・アプローチ機能
- 参加証明書の発行履歴管理
- レコメンドアルゴリズムの複雑化（初期は単純なJSONB内のスコア間距離差分など）
- メッセージチャット機能等の独自実装（LINEに誘導して完結させるため）
