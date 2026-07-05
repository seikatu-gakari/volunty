# 共通・基盤機能 E2E 拡充設計

## 目的

GitHub Issue #166 の C-E1〜C-E7 を Playwright で追加し、認証・認可境界、団体審査状態、ログアウト、凍結、所有権、モバイル主要導線を継続的に検証する。

既存の G1〜G3 と参加者向け E2E は再実装しない。Google OAuth プロバイダーとの実通信は行わず、既存のテスト認証ルート `/api/test-auth/login` と Playwright の `storageState` を使用する。

## 実装方針

### E2E の構成

`app/e2e/common-boundaries.spec.ts` を追加し、テスト名に C-E1〜C-E7 を明記する。認証・認可境界を一つの spec に集約し、Issue の受け入れ条件との対応を追跡しやすくする。

- C-E1: 未認証で `/mypage`、`/dashboard`、`/admin` にアクセスし、`/login?next=<元ルート>` へ遷移することを確認する。
- C-E2: 参加者、団体、管理者から他ロール専用ルートへアクセスし、`/forbidden` へ遷移すること、および対象ロールの情報が表示されないことを確認する。
- C-E3: 審査中・否認済み団体は `/dashboard` から `/onboarding/pending` へ遷移し、承認済み団体はダッシュボードを利用できることを確認する。
- C-E4: UI からログアウトした後、保護ルートへ戻れず `/login` へ遷移することを確認する。
- C-E5: 凍結済みユーザーが保護ルートへのログインを試みると強制ログアウトされ、ログイン画面で凍結メッセージを確認できることを検証する。
- C-E6: 別所有者団体が他団体の案件編集、応募者詳細、証明書詳細の URL へ直接アクセスしても、情報や更新 UI を取得できないことを確認する。
- C-E7: モバイル viewport で参加者・団体のハンバーガーメニューと、管理者画面の代表的な管理リンクを操作できることを確認する。

状態を変更するテストには専用ペルソナを使う。状態を共有する一連の操作だけを `describe.serial` にし、それ以外はテスト単位で独立させる。固定時間待機、CSS クラス依存セレクタは使用せず、role、label、text、URL を優先する。

### 認可境界

`app/src/proxy.ts` にロール別の専用ルートを明示する。

- 参加者専用: `/diagnosis`、`/mypage`、`/opportunities`、`/organizations`、`/recommendations`
- 団体専用: `/dashboard`
- 管理者専用: `/admin`

認証済みユーザーが別ロール専用ルートへアクセスした場合は `/forbidden` へ遷移する。オンボーディング判定と団体審査状態判定は既存の順序を維持し、ロール未選択や未完了ユーザーを誤って `/forbidden` へ送らない。

ロール境界は `app/src/proxy.test.ts` にマトリクス形式のユニットテストを追加する。ページや Server Action に既存の所有権チェックがある箇所は維持し、E2E で欠陥が判明した場合だけ Issue 達成に必要な範囲で修正する。

### ペルソナと seed

既存ペルソナに次を追加する。

- `organization-rejected`: 否認済み団体
- `organization-secondary`: 別所有者として利用する承認済み団体
- `participant-suspended`: 凍結済みアクセス確認専用ユーザー

`app/scripts/seed-e2e.ts` は Auth、`m_user`、団体プロフィール、案件、応募、証明書を冪等に初期化する。`organization-secondary` には承認済みプロフィールを作成し、既存の承認済み団体が所有するデータへアクセスさせる。`participant-suspended` は毎回 `isActive=false` と凍結理由を設定する。

所有権テストで利用する対象 URL は、主所有者の画面に表示される意味のあるリンクから取得し、別所有者の browser context で直接開く。DB の自動生成 UUID をテストへハードコードしない。

`app/scripts/seed-e2e.test.ts` と `app/src/lib/test-auth/personas.test.ts` を更新し、追加ペルソナ、審査状態、所有者分離、凍結状態、再 seed 時の巻き戻しを検証する。

### 凍結エラー表示

既存の proxy は凍結ユーザーを `/auth/signout?reason=suspended` へ送り、signout route は `/login?error=suspended` へ遷移させる。現状のログイン画面はこのエラーを表示しないため、`app/src/app/(auth)/login/page.tsx` に凍結メッセージを追加する。

表示条件は `error=suspended` の完全一致とし、通常の Google ログイン導線や `next` パラメータの引き継ぎは変更しない。`page.test.tsx` に表示・非表示のユニットテストを追加する。

## エラー処理と安全性

- 未認証は復帰先付き `/login`、ロール越境は `/forbidden`、未承認団体は `/onboarding/pending` に統一する。
- 所有権違反では対象情報と更新操作を表示しない。既存のページ仕様に合わせて 404 または安全なエラー表示を許容する。
- 凍結ユーザーのセッションは signout route で無効化し、理由は既知の `suspended` 値だけを UI 表示へ変換する。
- テスト認証ルートは既存の本番無効化ガードを維持する。Google OAuth の実通信、本番・Preview への破壊的テストは行わない。

## 検証

次を順番に実行する。

```bash
cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts src/proxy.test.ts 'src/app/(auth)/login/page.test.tsx'
cd app && npm test
cd app && npm run lint
cd app && npx tsc --noEmit
cd app && npm run build
make e2e
make e2e
```

完了条件は以下とする。

- C-E1〜C-E7 がテスト名から追跡できる。
- 既存 G1〜G3 と参加者・団体・管理者 E2E が成功する。
- 他ロール・他団体の非公開情報を閲覧・更新できない。
- seed の追加・初期化ロジックがユニットテストで検証される。
- lint、型チェック、全ユニットテスト、build、E2E 2回連続実行が成功する。

## スコープ外

- Google OAuth プロバイダーとの実通信
- 本番・Vercel Preview への破壊的テスト
- 全ページ・全 viewport のビジュアル回帰
- 性能・負荷試験
- 団体・管理者固有の業務ライフサイクル追加
