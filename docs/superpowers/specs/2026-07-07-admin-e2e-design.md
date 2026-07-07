# Issue #168 管理者向けE2E拡充 Design

## Goal

GitHub Issue #168「管理者向け機能のE2Eテストを拡充する」の A-E1〜A-E6 を Playwright で追跡可能にし、必要な E2E persona / seed fixture / seed 単体テストを追加する。

## Current state

- 既存 E2E は `app/e2e/admin.spec.ts` の A1〜A3 のみ。
- 管理者 UI の実装自体は存在している。
  - `/admin/users`: 名前/メール検索、ロールフィルター、凍結/解除。
  - `/admin/reviews`: 団体審査一覧、ステータスタブ、一覧上の承認/否認。
  - `/admin/reviews/[id]`: 団体審査詳細、承認/否認、空の否認理由のバリデーション。
  - `/admin/reviews/history`: 審査履歴。
- `seed:e2e` は `organization-pending` と `participant-suspendable` を毎回初期化するが、Issue #168 の専用 persona と承認/否認/履歴/フィルター fixture が不足している。
- 既存 A2/A3 は `admin` storageState で mutation を実行しているため、Issue #168 の「`admin` は読み取り専用、`admin-review` は審査/凍結 mutation 用」に合わせて整理する。
- 既存 A2/A3 は `div.rounded-[10px]` CSS クラス selector に依存しているため、テスト用に最低限のアクセシビリティ属性を追加して role/label selector に置き換える。

## Decisions

1. `participant-suspendable` は Issue 表記に合わせて `user-suspendable` に改名する。
   - storageState は `playwright/.auth/user-suspendable.json`。
   - email は `e2e-user-suspendable@example.com`。
   - 表示名は seed の `m_user.name` と Auth metadata で `E2E user-suspendable` に統一する。
2. `admin` は読み取り専用テストで使い、mutation を行う新規/既存テストは `admin-review` を使う。
   - `admin-review`: `e2e-admin-review@example.com`。
3. 団体審査 mutation は専用 persona を分離する。
   - `organization-review-approve`: `e2e-org-review-approve@example.com` / `E2E詳細承認団体`
   - `organization-review-reject`: `e2e-org-review-reject@example.com` / `E2E詳細否認団体`
4. A-E4 のステータスフィルターと A-E5 の履歴は、テスト順序に依存しない seed fixture を追加する。
   - `E2Eフィルター審査待ち団体`
   - `E2Eフィルター承認済み団体`
   - `E2Eフィルター否認済み団体`
   - `E2Eフィルター否認理由`
5. E2E は責務単位で分割する。
   - `app/e2e/admin.spec.ts`: 既存 A1〜A3。A2/A3 は `admin-review` で mutation。
   - `app/e2e/admin-users.spec.ts`: A-E1 と A-E6。
   - `app/e2e/admin-reviews.spec.ts`: A-E2〜A-E5。
6. TDD を適用する。
   - seed/persona は Vitest を先に追加して RED を確認する。
   - E2E は新 spec を先に追加して fixture/selector 不足による RED を確認してから実装する。

## Acceptance mapping

| Issue item | Test owner |
| --- | --- |
| A-E1: ユーザー検索/名前/メール/ロール/ゼロ状態 | `app/e2e/admin-users.spec.ts` |
| A-E2: 審査詳細から承認、詳細情報確認 | `app/e2e/admin-reviews.spec.ts` |
| A-E3: 審査詳細から否認、空理由バリデーション、否認状態/理由確認 | `app/e2e/admin-reviews.spec.ts` |
| A-E4: 審査一覧の pending/approved/rejected フィルター | `app/e2e/admin-reviews.spec.ts` |
| A-E5: 審査履歴の団体名/審査者/日時/否認理由 | `app/e2e/admin-reviews.spec.ts` |
| A-E6: 凍結ユーザーのユーザー側挙動と解除後利用再開 | `app/e2e/admin-users.spec.ts` |
| seed:e2e が審査/履歴/凍結状態を戻す | `app/scripts/seed-e2e.test.ts` |
| persona 追加/改名 | `app/src/lib/test-auth/personas.test.ts` |

## Verification target

- `cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts`
- `cd app && npx playwright test e2e/admin.spec.ts e2e/admin-users.spec.ts e2e/admin-reviews.spec.ts`
- `cd app && npm run lint`
- `cd app && npx tsc --noEmit`
- `cd app && npm test`
- `cd app && npm run build`
- `make e2e`
- `make e2e`
