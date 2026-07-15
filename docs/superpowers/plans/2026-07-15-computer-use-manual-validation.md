# Computer Use Manual Validation Execution Plan

> **For agentic workers:** Execute this plan inline with Codex Computer Use. Do not delegate browser operation to subagents. Track each step with checkbox state and record results in `docs/quality/manual-validation/2026-07-15-results.md`.

**Goal:** CodexがローカルのVoluntyをブラウザで手動操作し、正常系M-01と重要分岐B-01〜B-05を検証して結果を記録する。

**Architecture:** シェルはローカル環境の起動・seed・ログ確認だけに使用し、アプリの利用者操作はComputer Use経由のGoogle Chromeで実行する。各シナリオの前にE2E seedへ戻し、テスト認証URLで同一ブラウザのペルソナを切り替える。

**Tech Stack:** Next.js、ローカルSupabase、Docker Compose、Google Chrome、Codex Computer Use、Markdown

## Global Constraints

- 対象は `http://localhost:3000` のローカル環境のみ。
- Google OAuthは操作しない。`/api/test-auth/login` だけを使用する。
- 各シナリオ開始前に `cd app && npm run seed:e2e` を実行する。
- UI操作はComputer Useで行い、DOM直接操作やServer Action直接呼び出しで省略しない。
- 画面から観察できる結果を一次判定とし、DB直接確認だけでPassにしない。
- 認可違反や非公開情報の露出は必ずFailとする。
- Computer Useの確認ポリシーに該当する操作が現れた場合は、直前でユーザー確認を取る。
- detached HEADのためcommitは行わない。

---

### Task 1: 実行環境と結果記録の準備

**Files:**
- Create: `docs/quality/manual-validation/2026-07-15-results.md`
- Reference: `docs/superpowers/specs/2026-07-15-manual-validation-scenarios-design.md`

**Interfaces:**
- Consumes: `.env.local` のローカルE2E設定、`app/scripts/seed-e2e.ts`
- Produces: 起動済みの `http://localhost:3000`、初期化済みE2Eデータ、結果記録ファイル

- [ ] `make up` または既存プロセス確認でローカル環境を起動する。
- [ ] `cd app && npm run seed:e2e` を実行し、成功を確認する。
- [ ] Chromeで `http://localhost:3000` を開き、LPが表示されることを確認する。
- [ ] 結果Markdownへ対象commit、開始時刻、環境情報を記録する。

### Task 2: M-01正常系をComputer Useで実行する

**Files:**
- Modify: `docs/quality/manual-validation/2026-07-15-results.md`
- Reference: `docs/superpowers/specs/2026-07-15-manual-validation-scenarios-design.md`

**Interfaces:**
- Consumes: `organization-fresh`、`admin-review`、`participant-fresh`
- Produces: M-01-01〜M-01-21のPass / Fail / Blocked、証明書PDF確認結果

- [ ] 団体の初回登録と審査待ち制御を操作・確認する。
- [ ] 管理者で申請内容を確認し、承認と審査履歴を確認する。
- [ ] 団体で固定入力値の案件を作成する。
- [ ] 参加者で初回登録と簡易15問診断を完了する。
- [ ] おすすめ案件を絞り込み、固定メッセージで応募する。
- [ ] 団体で応募者情報を確認し、応募を承認する。
- [ ] 参加者でマッチング成立とLINE連絡先を確認する。
- [ ] 団体で活動完了に更新する。
- [ ] 参加者が証明書を申請し、団体が承認する。
- [ ] 参加者が証明書PDFをダウンロードして内容を確認する。
- [ ] M-01-01〜M-01-21の結果と証跡を結果Markdownへ記録する。

### Task 3: B-01団体否認・再申請を実行する

**Files:**
- Modify: `docs/quality/manual-validation/2026-07-15-results.md`

**Interfaces:**
- Consumes: `admin-review`、`organization-review-reject`
- Produces: 否認理由バリデーション、理由表示、再申請、再承認の結果

- [ ] seedを再実行する。
- [ ] 管理者で空理由の否認不可と理由付き否認を確認する。
- [ ] 団体で否認理由を確認して再申請する。
- [ ] 審査中のダッシュボード制御を確認する。
- [ ] 管理者で再承認し、団体で利用再開を確認する。
- [ ] B-01の結果を記録する。

### Task 4: B-02応募辞退を実行する

**Files:**
- Modify: `docs/quality/manual-validation/2026-07-15-results.md`

**Interfaces:**
- Consumes: `organization-approved`、`participant-lifecycle`
- Produces: 辞退状態、LINE非開示、診断生スコア非開示、重複応募防止の結果

- [ ] seedを再実行する。
- [ ] 参加者で審査中とLINE非表示を確認する。
- [ ] 団体で応募情報を確認し、辞退する。
- [ ] 参加者で辞退済み・LINE非表示・再応募不可を確認する。
- [ ] B-02の結果を記録する。

### Task 5: B-03アプローチを実行する

**Files:**
- Modify: `docs/quality/manual-validation/2026-07-15-results.md`

**Interfaces:**
- Consumes: `organization-approved`、`participant-onboarded`、`participant-lifecycle`
- Produces: 送信、重複防止、承諾、辞退、期限切れ、履歴状態の結果

- [ ] seedを再実行する。
- [ ] 団体から `participant-onboarded` へ固定アプローチを送る。
- [ ] 送信履歴と重複送信防止を確認する。
- [ ] `participant-onboarded` で承諾とLINE表示を確認する。
- [ ] `participant-lifecycle` で辞退と期限切れを確認する。
- [ ] 団体で回答状態の履歴を確認する。
- [ ] B-03の結果を記録する。

### Task 6: B-04凍結・解除を実行する

**Files:**
- Modify: `docs/quality/manual-validation/2026-07-15-results.md`

**Interfaces:**
- Consumes: `admin-review`、`user-suspendable`
- Produces: 凍結、強制退出、理由表示、解除後利用再開の結果

- [ ] seedを再実行する。
- [ ] 管理者で対象者を理由付きで凍結する。
- [ ] 参加者で強制退出と凍結メッセージを確認する。
- [ ] 管理者で凍結を解除する。
- [ ] 参加者で利用再開を確認する。
- [ ] B-04の結果を記録する。失敗時も解除またはseed復元を行う。

### Task 7: B-05認証・認可・所有権を実行する

**Files:**
- Modify: `docs/quality/manual-validation/2026-07-15-results.md`

**Interfaces:**
- Consumes: 未認証状態と設計書記載の6ペルソナ
- Produces: 未認証保護、ロール越境拒否、審査状態制御、他団体所有権拒否、ログアウト後制御の結果

- [ ] seedを再実行する。
- [ ] 未認証の保護ルート遷移を確認する。
- [ ] 参加者・団体・管理者のロール越境を確認する。
- [ ] 審査待ち・否認済み団体のダッシュボード制御を確認する。
- [ ] 自団体URLを別団体で開き、情報と操作が非表示であることを確認する。
- [ ] ログアウト後に保護ルートへ戻れないことを確認する。
- [ ] B-05の結果を記録する。

### Task 8: 結果を集約して完了判定する

**Files:**
- Modify: `docs/quality/manual-validation/2026-07-15-results.md`

**Interfaces:**
- Consumes: M-01とB-01〜B-05の全記録
- Produces: 総合判定、Fail / Blocked一覧、再検証対象

- [ ] 全手順にPass / Fail / Blockedがあることを確認する。
- [ ] M-01のPDF確認結果を含める。
- [ ] Failごとに期待結果、実際の結果、再現手順、ペルソナ、証跡を記録する。
- [ ] Blockedがあれば環境要因と未実施範囲を記録する。
- [ ] 総合判定をPass / Fail / Blockedで記録する。
