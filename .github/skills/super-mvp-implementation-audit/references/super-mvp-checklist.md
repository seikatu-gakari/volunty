# Super MVP 実装状況チェックリスト

このチェックリストは [docs/design/super-mvp-design.md](../../../../docs/design/super-mvp-design.md) の実装状況をコードベースから判定するための観点集。

## フェーズ0: 基盤（DB + Auth + Middleware）

| ID  | 設計項目                | 実装確認ポイント                                                                                                                         |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0-1 | Supabase DBスキーマ構築 | `users`, `participants`, `organizations`, `opportunities`, `applications` 相当のテーブル / Enum / FK / Unique制約 / migrationがある      |
| 0-1 | RLSポリシー             | Supabase migrationやSQLに、本人・所属団体・公開範囲に応じたアクセス制御がある                                                            |
| 0-2 | OAuth callback          | `/auth/callback/route.ts` があり、認証後にユーザー情報を確定し、オンボーディングへ遷移する                                               |
| 0-2 | `users` レコード作成    | Supabase Authユーザーとアプリ側ユーザーが同期される。triggerまたはcallbackで作成される                                                   |
| 0-3 | ロールベース保護        | 未ログイン→`/login`、role未設定→`/onboarding/role`、プロフィール未作成→各オンボーディング、未承認団体→`/onboarding/pending` が実装される |

## フェーズ1: 参加者フロー

| ID  | 設計項目                          | 実装確認ポイント                                                         |
| --- | --------------------------------- | ------------------------------------------------------------------------ |
| 1-1 | `/onboarding/role`                | 参加者 / 団体を選択でき、選択結果がDBに保存される                        |
| 1-1 | `/onboarding/participant`         | 名前・地域など参加者プロフィールを登録できる                             |
| 1-1 | `registerParticipant(data)`       | 入力検証、認可、`participants` 保存、role更新、リダイレクトがある        |
| 1-2 | `submitDiagnosis(answers)`        | 50問回答を計算し、`diagnosis_type` と `diagnosis_scores` を保存する      |
| 1-2 | `/diagnosis/result`               | 保存済み診断結果を表示できる。未診断時の扱いがある                       |
| 1-3 | `/recommendations`                | 案件一覧をマッチングスコア順に表示できる                                 |
| 1-3 | `fetchRecommendations(filters?)`  | カテゴリ・地域フィルタ、性格スコア距離順ソート、公開案件のみ取得がある   |
| 1-4 | `/opportunities/:id`              | 案件詳細、団体名、活動概要、相性スコア、応募ボタン、団体詳細リンクがある |
| 1-4 | `applyToOpportunity(id, message)` | 重複応募防止、参加者認可、応募メッセージ保存、ステータス初期値がある     |
| 1-5 | `/organizations/:id`              | 団体情報、活動内容、他の募集案件一覧を読み取り専用で表示する             |

## フェーズ2: 団体フロー

| ID  | 設計項目                                                 | 実装確認ポイント                                                        |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2-1 | `/onboarding/organization`                               | 団体名、説明、LINE ID、連絡先メールを登録できる                         |
| 2-1 | `registerOrganization(data)`                             | `organizations.status = pending` で保存し、role更新と審査待ち遷移がある |
| 2-1 | `/onboarding/pending`                                    | 未承認団体向けの審査待ち表示がある                                      |
| 2-2 | `/dashboard`                                             | 自団体の募集案件一覧を表示する                                          |
| 2-2 | `/dashboard/opportunities/new`                           | 募集案件を作成できるフォームがある                                      |
| 2-2 | `/dashboard/opportunities/:id/edit`                      | 自団体案件のみ編集できる                                                |
| 2-2 | `createOpportunity(data)`                                | 団体認可、承認済み団体チェック、入力検証、required_traits保存がある     |
| 2-2 | `updateOpportunity(id, data)`                            | 所有者チェック、公開/停止更新、入力検証がある                           |
| 2-2 | `fetchMyOpportunities()`                                 | ログイン団体の案件のみ取得する                                          |
| 2-3 | `/dashboard/opportunities/:id`                           | 応募者一覧をマッチングスコア順に表示し、承認/辞退できる                 |
| 2-3 | `fetchApplicantsForOpportunity(opportunity_id)`          | 所有者チェック、参加者診断情報、応募メッセージ、スコア付きで取得する    |
| 2-3 | `updateApplicationStatus(id, new_status)`                | 所有者チェック、許可ステータスのみ更新、承認時のLINE ID開示につながる   |
| 2-4 | `/dashboard/opportunities/:id/applicants/:applicationId` | 応募者詳細、診断タイプ、BIG5スコア、応募メッセージを表示する            |
| 2-4 | `fetchApplicantDetail(application_id)`                   | 所有者チェック付きで応募者詳細を取得する                                |

## フェーズ3: 横断機能 + 仕上げ

| ID  | 設計項目                | 実装確認ポイント                                                                                        |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| 3-1 | `/mypage`               | 参加者プロフィール、応募進捗、成立時の相手情報を表示する                                                |
| 3-1 | `fetchMyApplications()` | 参加者本人の応募のみ取得し、`approved` の場合のみ団体LINE IDを返す                                      |
| 3-2 | 総合テスト              | 認証、オンボーディング、診断、応募、承認、LINE ID開示の主要フローを確認できるテストまたは手動手順がある |
| 3-3 | Vercelデプロイ          | 本番/Preview向け設定、環境変数、standalone出力、DB接続が整っている                                      |

## 横断品質チェック

- TypeScript strictで `any` を避けている
- Server Componentをデフォルトにし、必要な箇所のみ `"use client"` を使っている
- `@/` パスエイリアスを使っている
- Server Actionsではログインユーザーを取得し、ロール・所有者・ステータスを検証している
- UIテキストとコメントが日本語になっている
- ドメインロジックに同ディレクトリの `.test.ts` / `.test.tsx` がある
