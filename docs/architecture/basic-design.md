## 基本設計

> **注意（2026-07-05）**: 性格診断・マッチングに関する記述は再設計により更新されています。
> 現行仕様は [docs/design/personality-matching-redesign.md](../design/personality-matching-redesign.md) と
> `specs/personality-diagnosis-functionality.md` を参照してください
> （IPIP-BFM-50日本語版・全50問、診断とマッチングの分離、ルールベースランキング）。


### 1. 前提と対象範囲
- 対象フェーズ: Phase 1 (MVP)。性格診断と団体・参加者のマッチングを最優先で実装する。
- 非対象: 東京アプリ連携、キャラクター画像生成、詳細分析レポート、双方向アプローチ通知など後続フェーズ要素。
- フロントエンド技術スタック: Next.js (TypeScript) / Jotai / XState / React Hook Form / Yup / MUI。テストは Vitest、UI ドキュメンテーションに Storybook を使用。
- バックエンドは未決。REST API or GraphQL を前提に調査継続。
- 認証は外部 OAuth 2.0 (Google / LINE 等) 連携を前提に、独自アカウント管理は行わない。
- LINE 連携は MVP では導線設計のみに留め、API 接続は Phase 2 以降で検討する。

### 2. システム構成概要

#### 2.1 利用者ロール
- **参加者**: 性格診断の受検、結果閲覧、団体への応募。
- **団体担当者**: 団体アカウント管理、募集作成、候補者の確認と承認。
- **管理者**: 監視とサポート。MVP では最低限の監視 UI またはバックオフィス操作に留める。

#### 2.2 コンポーネント構成 (案)
```
[Webクライアント (Next.js)] -- HTTPS/JSON --> [APIサーバ (TBD)] -- SQL --> [データベース (PostgreSQL想定)]
												   \
													--> [外部サービス: OAuthプロバイダ, LINE]
```
- フロントエンドは Next.js App Router を採用し、MUI で UI コンポーネントを構築。
- グローバル状態は Jotai、複雑なフローは XState で管理。フォームは React Hook Form + Yup を使いバリデーションロジックを共通化。
- OAuth 認証モジュールを API サーバに実装し、参加者/団体のログインを共通化。
- DB はリレーショナル前提。マッチングスコアや診断結果は正規化テーブルで管理。
- Storybook で UI コンポーネントをドキュメント化し、デザインレビュー時に使用。

#### 2.3 デプロイ・運用 (暫定)
- インフラは後続検討。GitHub Actions CI で lint/test を自動化し、CD は別途決定。
- ログ/メトリクスはホスティング先 (例: Vercel, Fly.io, Render, Railway 等) の標準機能を暫定利用。

### 3. 画面・ユースケース (MVP)

#### 3.1 参加者向け
1. トップ/LP → OAuth ログイン
2. 性格診断スタート → 質問回答 (10〜20 問想定)
3. 診断結果表示 → おすすめ団体閲覧
4. 団体詳細 → 応募送信
5. 応募状況確認 (マッチング履歴)

#### 3.2 団体向け
1. 団体登録 (既存ユーザーの LINE or Google ログイン)
2. 団体プロフィール・募集情報作成
3. おすすめ参加者リスト閲覧 (スコア順)
4. 応募承認／辞退操作
5. マッチ成立後の連絡方法 (LINE 情報確認)

#### 3.3 管理者向け
- 参加者・団体アカウントの監視 (一覧/凍結)
- 異常検知や問い合わせ対応 (手動対応を想定)

### 4. 性格診断フロー設計
- 質問セット: 要件の MBTI / ビッグファイブ / 16personalities / エニアグラムから最適組み合わせを検討。暫定は MBTI ベース + ビッグファイブ補助。
- フロー: 質問取得 → 回答送信 → スコア集計 → タイプ決定 → 結果保存。
- スコアリング: 回答値を尺度 (例: 1〜5) で集計し、タイプ判定ロジックに変換。重み付けは診断設計タスクで確定。
- 結果表示: タイプ名、主要特性、推奨ボランティア活動カテゴリ、相性の高い団体条件を表示。
- 共有導線: SNS シェアは Phase 2 で実装。MVP では結果のコピー機能に留める。

### 5. マッチングロジック叩き台
- 入力: `DiagnosisResult` (性格タイプ、特性スコア) + 参加者希望条件。
- 団体側データ: 活動カテゴリ、求める性格特性、活動頻度、場所。
- マッチング: 類似度 (コサイン類似度など) + 条件フィット率を合成したスコアを算出。
- 推薦: スコア上位 N 件を提示。アルゴリズムは将来の AB テストや学習モデルに置換できるよう抽象化。
- マッチング履歴: `MatchingCandidate` テーブルで候補選出履歴を保存し、結果の追跡を可能にする。

### 6. AI 活用領域
- **目的**: 判断材料が不足しがちなボランティアマッチングと活動後の振り返りに AI を活用し、候補提示とフィードバック品質を向上させる。
- **利用ポリシー**: モデル提供は AWS Bedrock 等のマネージド AI サービスを利用し、自前でのディープラーニング学習は行わない。個人情報は前処理で匿名化し、AI 出力は必ず人間がレビューした上でユーザーへ提示する。生成結果は説明可能な形でログ化。

#### 6.1 おすすめボランティアのレコメンド
- Phase 1 では既存の診断スコア + 条件マッチング (ルールベース) を実装し、AI 介入ポイントを明確化。
- Phase 2 以降で協調フィルタリングや埋め込み類似度などの ML 手法を導入し、Bedrock による推論 API を活用して推薦スコアの重み付けを自動最適化する。
- 推薦パイプライン例:
	1. 診断結果と応募・成立履歴を特徴量として集約。
	2. モデル or LLM によるスコアリングを実施。
	3. 上位候補を提示し、利用者のフィードバックを取得してモデルに反映。
- フォールバック: モデルが信頼閾値を下回る場合はルールベースのスコアを提示。

#### 6.2 団体向け活動分析とフィードバック生成
- 入力: 団体が登録した活動内容・参加者フィードバック (テキスト/定量)。
- 前処理: 個人名や連絡先など PII をマスキングし、トピック分類を実施。
- 分析ステップ: AWS Bedrock 経由の LLM によりポジティブ/改善ポイントの抽出、次回の改善提案、参加者に伝えるべき魅力の要約を生成。
- 出力: 団体ダッシュボードで「活動レポート草案」として表示し、担当者が編集・承認したうえで参加者に配信。
- 監査: 生成結果と承認者をログに残し、後日差分検証できるようにする。

### 7. データモデル初期案 (概略)

| エンティティ          | 主要属性                                                                    | 補足                                              |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| User                  | id, role(participant / organization / admin), oauth_provider, oauth_subject | 共通アカウント情報                                |
| ParticipantProfile    | user_id, demographic, interests, availability                               | 参加者詳細プロファイル                            |
| OrganizationProfile   | user_id, organization_name, contact_line_id, activity_tags                  | 団体情報と連絡手段                                |
| DiagnosisQuestion     | id, category, text, options                                                 | 診断質問マスタ                                    |
| DiagnosisAnswer       | user_id, question_id, score                                                 | 回答ログ                                          |
| DiagnosisResult       | user_id, type, trait_scores(json), concluded_at                             | 判定結果                                          |
| Opportunity           | organization_id, title, description, requirement_traits                     | 募集案件                                          |
| MatchingCandidate     | participant_id, opportunity_id, score, status                               | ステータス: queued / applied / matched / declined |
| Feedback (Phase2以降) | source_type(event / participant), raw_text, ai_summary, reviewer_id         | AI 生成サマリと承認ログを保持                     |

### 8. API 仕様叩き台
- 認証: `/auth/login` → OAuth リダイレクト、`/auth/callback` → トークン発行。
- 診断: `/diagnosis/questions`(GET), `/diagnosis/answers`(POST), `/diagnosis/result`(GET)。
- マッチング: `/opportunities`(GET), `/opportunities/{id}/apply`(POST), `/candidates`(GET), `/candidates/{id}/decision`(POST)。
- 管理: `/admin/users`(GET) 等。MVP では管理 UI 省略のためシンプルな API のみにする想定。
- レート制限と監査ログを考慮し、API Gateway 導入の可否は今後検討。

### 9. 外部連携・非機能
- **OAuth プロバイダ**: Google / LINE。参加者・団体とも同一フローを利用。
- **LINE 連携**: MVP では公式 LINE ID の登録のみ。メッセージ送信 API 連携は Phase 2。
- **東京アプリ連携**: API 仕様未公開のため、独立したアダプタ層を想定しつつモジュール化準備のみ実施。
- **セキュリティ**: HTTPS 強制、PII の暗号化 (DB 暗号化 / KMS 利用を検討)、ログには個人情報を残さない。
- **パフォーマンス**: 診断結果表示は 3 秒以内を目標。バッチ処理は夜間スケジュールを想定。

### 10. テスト方針
- ユニットテスト: Vitest + Testing Library。Jotai アトム、XState マシン、診断スコア計算関数をカバー。
- Lint/型チェック: ESLint (Next.js 推奨設定) と TypeScript `tsc --noEmit` を CI で実行。
- Storybook: Storybook Test Runner で UI 振る舞いを継続的にチェック。a11y アドオンでアクセシビリティ確認。
- 統合テスト: API モックを用いた画面テスト (Vitest) で診断回答 → 結果表示 → マッチング提示のシナリオを確認。
- E2E テスト: 参加者の主要フローを Playwright/Cypress で自動化することを検討。
- テストデータ: 質問マスタとモック診断結果を fixtures で管理し、線形に再現可能な状態を維持。

### 11. 今後の課題・未決事項
- 診断アルゴリズムの最終選定と質問セット設計 → 専門家レビューが必要。
- 技術スタック (フロント/バック/インフラ) の正式決定 → 決定次第、本設計書を詳細化。
- キャラクター画像生成手段 (外部 API 利用か、テンプレ生成か) の検討 → Phase 3 で議論。
- 東京アプリ API 仕様の確認と接続方式 → Phase 3 で詳細設計。
- 監視・運用ツール (エラートラッキング、ログ) の選定。
- AI モデル/プロンプトの選定と安全性検証。出力品質の KPI (活用率、編集率) を設定し改善 PDCA を回す。

> **TODO:** 技術スタックが確定したら、本ドキュメントのコンポーネント構成・API・データモデルを詳細化し、`.github/knowledge-base` の Decision Log に反映すること。