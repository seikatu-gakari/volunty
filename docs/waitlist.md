# 公開前の待機リスト

未ログインの `/` はメールで開始通知を受け取る待機リスト導線に統一する。既存利用者・管理者のGoogle OAuth認証や直接URLへのアクセスは変更しない。登録で認証アカウントは作らず、この変更ではメール送信・配信サービス連携も行わない。

## 保存と安全対策

- `POST /api/waitlist` でサーバー側検証し、既存のPrisma接続で `t_waitlist_entry` に正規化メールと登録日時を保存する。
- メールは前後空白除去・小文字化して一意保存。重複時も初回と同じ成功応答を返し、登録の有無を外部に漏らさず、元の登録日時・案内日時を変更しない。
- 一般的なASCIIメールに対応。メール所有の検証は未実施のため、保存済みメールを本人確認済み会員として扱わない。
- メール一覧の公開APIはない。テーブルはRLS有効かつ `PUBLIC` / `anon` / `authenticated` の権限を取消。アプリサーバーの既存DB接続のみが操作する。
- Origin確認・JSON/2KB上限・メール形式検証・honeypotを実施する。送信回数制限は設けず、IPアドレスやIPのハッシュは取得・保存しない。追加の秘密値は不要。
- honeypotだけでは自動登録を完全には防げない。CAPTCHA/外部サービスは追加していない。

## 保持期間と削除運用

方針は「開始案内後30日以内、未開始でも登録から1年で削除」。両方の期限がある場合は早い方を採用する。LPに方針を表示するが、自動削除とは表記しない。運営表示は `運営: SAGARAKA`、削除窓口は `sagaraka.office@gmail.com`。

- `created_at` は初回登録日時。重複登録で保持期限を延ばさない。
- `notified_at` は実際に開始案内を送信した日時。登録時はNULLで、APIは更新しない。将来の承認済み配信処理または担当者の操作で、送信成功を確認できた対象だけに初回日時を記録する。送信予定日や一括推測で埋めない。再送で更新しない。
- 1年はUTCの暦年、30日はUTCの30日間として計算する。うるう日の翌年期限は2月28日。登録1年と案内30日の早い方までに削除する。
- このPRはスケジューラー・配信機能・自動削除ジョブを追加しない。アクセス時のついで削除も行わない。期限の実行を保証するには、公開前に担当者と削除運用を確定する必要がある。
- 日次確認を提案する場合、次回確認までに期限を迎える行を先に削除する運用とする。期限到達済みだけを毎日消す運用では最大1日超過する。日次運用は未確定であり、担当者の継続作業として承認済みとは扱わない。
- 利用者からの削除依頼では、本人確認と対象確認を行い、承認済みの手順で該当行を削除する。メール一覧やメールを含むログ・エクスポートを不要に残さない。バックアップに残るデータの保存期間も公開前に確認する。

### 担当者用SQL（このPRでは本番実行しない）

まず対象DBを確認し、読み取り専用で件数を確認する。`cutoff` は今回の確認時刻。日次運用を採用する場合は、次回確認予定時刻を設定して期限前に削除する。公開前に運用頻度・対象・実行権限を承認する。

```sql
BEGIN;
SET LOCAL TIME ZONE 'UTC';
WITH cutoff AS (SELECT CURRENT_TIMESTAMP AS at)
SELECT count(*) AS deletion_candidates
FROM public.t_waitlist_entry, cutoff
WHERE created_at + INTERVAL '1 year' <= cutoff.at
   OR notified_at + INTERVAL '30 days' <= cutoff.at;
ROLLBACK;
```

対象件数・対象DB・削除範囲を確認し、削除の承認を得てから次を使用する。`ROLLBACK` のままなら件数を確認して元に戻す。実際の削除を承認された場合だけ末尾を `COMMIT` に変更する。メール値は出力しない。

```sql
BEGIN;
SET LOCAL TIME ZONE 'UTC';
WITH cutoff AS (SELECT CURRENT_TIMESTAMP AS at), deleted AS (
  DELETE FROM public.t_waitlist_entry USING cutoff
  WHERE created_at + INTERVAL '1 year' <= cutoff.at
     OR notified_at + INTERVAL '30 days' <= cutoff.at
  RETURNING id
)
SELECT count(*) AS deleted_count FROM deleted;
ROLLBACK;
```

## 公開前の作業（このPRでは実行しない）

1. 既存の [本番DB手順](branch-workflow.md#本番dbマイグレーション) では、mainへのマージを契機に `Production DB Migration` が `app/` で `npx prisma migrate deploy` を自動実行する。実際の対象DB・バックアップ・**すべての未適用migration**・`PRODUCTION_DATABASE_URL` / `PRODUCTION_DIRECT_URL` の設定を確認し、この本番変更を含めてマージ承認を得る。`20261005004718_waitlist_landing` のSQLはPrisma/Supabase両方に置くが、Supabaseへ手動で先に二重適用しない。既に適用された環境のmigrationを書き換える手順として使用しない。
2. Previewで登録動作を試す場合は、本番とは分離したテストDBを設定する。本番DBを参照するPreviewへテスト登録しない。既存の `DATABASE_URL` を利用し、新しいDBサービス権限やレート制限用の秘密値は不要。
3. 利用目的・運営表示・削除窓口・保持期間、担当者と期限内削除の運用を確認してから公開する。現在のLPのリンクは利用目的説明であり、未整備のプライバシーポリシーへのリンクを捏造しない。
4. サービス開始時の通知配信は別途承認・実装する。本実装からメールは送られない。

## 検証

- UT: `cd app && npx vitest run src/lib/waitlist src/app/api/waitlist src/app/components/lp/WaitlistForm.test.tsx src/app/components/lp/LPBottomCTA.test.tsx`
- DB権限/重複/保持期限境界: `bash supabase/rls.test.sh`（一時PostgreSQLを作成。PostgreSQLツール必須）
- E2E: 既存のローカルSupabase手順で `make e2e`。`waitlist.spec.ts` はローカルDBのときだけ登録し、登録結果と12件の同時重複登録を確認する。
- LPの390px/1440px、未入力、不正形式、送信中、失敗後再試行、登録完了、ヘッダー/フッターの導線を確認する。
