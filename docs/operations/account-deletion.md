# アカウント削除 saga 運用手順

## ロールアウト

1. `ACCOUNT_DELETION_ENABLED` を未設定または `false` にしたまま migration を先行適用する。
2. `t_account_deletion_request` の存在と、`anon` / `authenticated` に権限がないことを読み取り確認する。
3. `auth.users LEFT JOIN public.m_user` で孤立 Auth ユーザー件数を確認する。既存の孤立ユーザーは自動削除しない。
4. アプリをデプロイし、利用者 UI と Server Action が停止中であることを確認する。
5. `ACCOUNT_DELETION_ENABLED=true` を設定し、テストアカウントで Auth・業務データ・台帳がすべて削除されることを確認する。

## 監視と再処理

- `/admin/users` の「削除処理保留」で件数、最古受付時刻、試行回数、正規化エラーコードを確認する。
- 構造化ログ `event=account_deletion_pending` を監視する。ログには request ID、phase、error code だけを含める。
- 1件でも滞留した場合は kill switch を無効化し、原因解消後に管理画面の「再処理」を実行する。
- `auth_delete_failed` では業務データが残る。`data_cleanup_failed` では Auth 削除済みのため、利用者へ再ログインを依頼しない。

## ロールバック・復旧

- 異常時は最初に `ACCOUNT_DELETION_ENABLED=false` として新規削除を止める。
- 台帳と additive migration は残し、保留レコードを冪等に再処理する。
- 台帳が0件になるまで旧実装へ戻さず、テーブルを削除しない。
- 本変更は既に cascade 削除された過去の業務データを復元しない。復旧が必要な場合は個別に調査する。
