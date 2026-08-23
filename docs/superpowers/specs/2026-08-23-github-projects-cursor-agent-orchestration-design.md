# GitHub Projects × Cursor Cloud Agent 自律開発基盤 設計

## 目的

Volunty の GitHub Issue を起点に Cursor Cloud Agent を起動し、設計、実装、テスト、Pull Request の Ready 化までをクラウド上で進める。GitHub Actions を決定論的な Orchestrator、GitHub Project を Control Plane とし、最終レビューと `main` へのマージだけを人間が担う。

この設計は、提示された「GitHub Projects × Cursor Cloud Agent 自律開発基盤 仕様書 v1.0」を Volunty の現行リポジトリ、GitHub Project、Pull Request CI、Vercel Preview、Codex Cloud 運用へ適用するための具体化である。

## 成功条件

- `agent-ready` を付けた Issue だけが Cursor Cloud Agent へ一度だけ dispatch される。
- Cursor が作成した妥当な Draft PR を ACK として、Issue の `agent-ready` を削除し Project を `In Progress` にする。
- Human Input、Blocked 復帰、Rework、CI 自動修正、Human Review、Cancelled、Done が仕様どおり遷移する。
- Project Status を変更できる自動化は GitHub Actions の Orchestrator だけである。
- PR と Issue の会話、Project 履歴、Actions ログ、Git history だけで状態と判断を監査できる。
- Cursor Cloud Agent、GitHub Actions、Vercel Preview はローカル Mac が停止していても動作する。
- Agent は `main` を直接 push・merge せず、本番シークレットや本番 DB を操作しない。
- 既存の Codex Cloud、Codex Review、Vercel Preview、Production DB Migration を壊さない。

## 採用方針

### Cursor を新しい標準フローにする

今後の自律開発は次を標準とする。

```text
Issue
  -> agent-ready
  -> GitHub Actions
  -> @cursor
  -> Cursor Cloud Agent
  -> Draft PR
  -> CI / Human Input / Review
  -> Human merge
```

既存の Codex Cloud と GitHub Copilot は削除しない。人間が明示的に開始する手動フォールバックとして残す。`agent-ready` から自動起動する Agent は Cursor だけとし、同じ Issue を複数 Agent へ自動 dispatch しない。

### 既存運用との境界

| 対象 | 方針 |
| --- | --- |
| Pull Request CI | 既存の `.github/workflows/ci.yml` を利用する。判定対象 workflow 名は `Pull Request CI` |
| Vercel | `cursor/*` への push で既存の Preview を作成する |
| Codex Review | 既存の自動レビューを維持し、Human Review の代替にはしない |
| Production DB Migration | `main` merge 後の既存 workflow を変更しない |
| Codex Cloud | `codex/*` の手動フローとして維持する |
| Cursor Cloud | `cursor/*` の `agent-ready` 標準フローとして利用する |
| `main` merge | 常に人間だけが実行する |

### GA 機能だけを本番経路に使う

- GitHub Issues、Issue dependencies、Pull Requests、Actions、Projects、REST/GraphQL API の正式提供機能を使う。
- Cursor の GitHub `@cursor` 連携と Cloud Agent を使う。
- Cursor Agent API、強制 Kill API、Projects preview webhook、定期 polling は使わない。
- Cursor の Teams 限定 CI 自動修正には依存せず、GitHub Actions のコメントで同じ Agent を再開する。

## 現状と移行対象

### GitHub Project

対象は organization `seikatu-gakari` の Project `#2` とする。Status の現行値は次のとおりである。

```text
Backlog
Ready
In progress
In review
Done
```

初期移行では item を作り直さず、option を次のように変更する。

| 現在 | 移行後 | 処理 |
| --- | --- | --- |
| `Backlog` | `Backlog` | 維持 |
| `Ready` | `Human Input` | rename。実行直前に item 数が想定どおりか再確認する |
| `In progress` | `In Progress` | 表記を正規化 |
| `In review` | `Human Review` | rename |
| `Done` | `Done` | 維持 |
| なし | `Rework` | 追加 |
| なし | `Blocked` | 追加 |
| なし | `Cancelled` | 追加 |

Project の built-in workflow は次のように整理する。

| built-in workflow | 移行後 |
| --- | --- |
| open Issue の auto-add | 維持 |
| sub-issue の auto-add | 維持 |
| item added -> Backlog | 無効化 |
| item closed -> Done | 無効化 |
| PR linked -> In progress | 無効化 |
| PR merged -> Done | 無効化 |
| Status Done -> Issue close | 無効化 |

Status 更新は Orchestrator のみに一本化する。新規 Issue の `Backlog` 設定も `agent-start.yml` の `issues.opened` 処理が行う。

### Cursor Cloud

既存の `seikatu-gakari/volunty` 用 Environment を利用する。

- Node.js 22
- install: `cd app && npm ci --no-audit && npm run db:generate`
- branch prefix: `cursor/`
- Pull Request 作成: Single Model Run で有効
- 本番シークレット: 登録しない

既存 Environment は正常に build されているため、初期版では `.cursor/environment.json` を追加して上書きしない。再現手順はリポジトリの運用文書へ記録し、Repository managed environment への移行は別変更として扱う。

Cursor Cloud が使う MCP や外部連携は Cursor Cloud 側で設定し、ローカル Mac だけにある `.cursor/mcp.json` やローカル MCP process には依存しない。GitHub、Context7、Supabase、Vercel を利用する場合も、タスクに必要な read-only または非本番の権限に限定する。

## システム構成

```text
Human yuto90
  | Issue / label / PR comment / review / merge
  v
GitHub Issues + Project #2 + Pull Requests
  | GitHub events
  v
GitHub Actions workflows
  | trusted default-branch orchestrator
  | yuto90 fine-grained PAT
  | @cursor comment / label / Project Status
  v
Cursor Cloud Agent
  | cursor/* branch / commits / Draft PR / PR comments
  v
Pull Request CI + Vercel Preview + Codex Review
  |
  v
Human review and merge -> Issue close -> Done
```

永続的な専用 DB は設けない。GitHub 上のデータと hidden marker を監査・冪等性の正本にする。

## リポジトリ構成

最低限、次を追加または更新する。

```text
.github/
├── agent-orchestrator.json
├── scripts/
│   └── agent-orchestrator/
│       ├── main.mjs
│       ├── core.mjs
│       ├── github.mjs
│       ├── project.mjs
│       └── *.test.mjs
└── workflows/
    ├── agent-start.yml
    ├── agent-pr-created.yml
    ├── agent-comments.yml
    ├── agent-ci.yml
    ├── agent-review.yml
    ├── agent-merge.yml
    └── agent-cancel.yml

.cursor/
└── skills/
    ├── architecture/SKILL.md
    ├── implementation/SKILL.md
    ├── testing/SKILL.md
    ├── code-review/SKILL.md
    ├── human-escalation/SKILL.md
    ├── create-pr/SKILL.md
    └── fix-ci/SKILL.md

docs/
└── cursor-cloud.md
```

Workflow ごとに GitHub API 処理を複製しない。package 追加を必要としない Node.js 22 の共通 Orchestrator を使用し、workflow は event と command 名を渡す薄い entry point にする。

## 固定設定

`.github/agent-orchestrator.json` に秘密でない固定値を置く。

```json
{
  "owner": "seikatu-gakari",
  "repository": "volunty",
  "projectNumber": 2,
  "operator": "yuto90",
  "agentActors": ["yuto90", "cursor[bot]"],
  "labels": {
    "ready": "agent-ready",
    "cancel": "agent-cancel"
  },
  "statuses": [
    "Backlog",
    "In Progress",
    "Human Input",
    "Human Review",
    "Rework",
    "Blocked",
    "Done",
    "Cancelled"
  ],
  "ciWorkflow": "Pull Request CI",
  "ciRetryLimit": 3,
  "defaultBranch": "main",
  "cursorBranchPrefix": "cursor/"
}
```

Project、Status field、option、item の ID は環境固有値なので hard-code しない。実行時に Project API から解決し、Status 名が不足・重複していれば mutation せず失敗させる。

## 状態モデル

### Status

| Status | 意味 |
| --- | --- |
| `Backlog` | 未実行。dispatch 済みでも Draft PR ACK 前はここに留まる |
| `In Progress` | Cursor Cloud Agent が同じ PR session で作業中 |
| `Human Input` | Agent が重要判断について人間の回答を待つ |
| `Human Review` | 実装完了 marker、最新 CI Green、PR 非 Draft を満たした最終レビュー待ち |
| `Rework` | Human Review で changes requested となり、修正指示待ち |
| `Blocked` | 3 回の自動 CI 修正後も失敗するなど、自動解消できない |
| `Done` | default branch へ PR merge 済みかつ linked Issue closed |
| `Cancelled` | `agent-cancel` により論理停止した terminal state |

### 許可する遷移

| From | Event / guard | To |
| --- | --- | --- |
| Status なし | 新規 Issue を Project へ登録 | `Backlog` |
| `Backlog` | 妥当な Draft PR の `opened` ACK | `In Progress` |
| `In Progress` / `Rework` | Agent の `<!-- agent:human-input -->` | `Human Input` |
| `Human Input` / `Blocked` / `Rework` | `yuto90` の PR `@cursor` comment | `In Progress` |
| `In Progress` / `Rework` | ready marker + current-head CI success + PR 非 Draft | `Human Review` |
| `Human Review` | `yuto90` の `changes_requested` review | `Rework` |
| active state | `yuto90` が `agent-cancel` を付与 | `Cancelled` |
| active state | default branch merge + linked Issue close | `Done` |

`Done` と `Cancelled` は terminal state とし、後続イベントで上書きしない。`Cancelled` の Cursor process を強制 Kill はしないが、Actions はコメント投稿と状態遷移を停止する。

## Issue と PR の対応

- Issue は Task の正本であり、要求、dependencies、開始、cancel、close を保持する。
- PR は一つの Cursor Agent session であり、進捗、Human Input、回答、CI、review、rework を保持する。
- 一つの Agent-managed PR は、同じ repository の Issue を `Fixes #N` でちょうど一つだけ閉じる。
- Agent-managed Issue に active な Agent PR を複数作らない。
- 対応関係は GitHub の closing issue reference を GraphQL で検証し、PR 本文の曖昧な自然言語だけには依存しない。

## 監査 marker

固定 marker は自然言語とは分離する。

```html
<!-- agent:dispatch:v1 issue=123 -->
<!-- agent:human-input -->
<!-- agent:ready-for-review -->
<!-- agent:ready-for-review:v1 head_sha=abc -->
<!-- agent:ci-retry:v1 run_id=123456 head_sha=abc retry=1 -->
```

- dispatch marker は最初の `@cursor` Issue comment に含める。
- Human Input と ready marker は Agent が対応 PR に投稿する。ready comment には仕様上の固定 marker と current head SHA 付き marker の両方を入れる。
- CI retry marker は Actions が `@cursor` 修正依頼に含める。
- event 固有値を含む marker が既にあれば同じ comment を再投稿しない。
- marker の version を入れ、将来の format 変更で既存履歴を壊さない。

Project history、label history、review、Actions run、commit は GitHub が保持するため、追加の監査 DB は作成しない。

## 初回 dispatch

`agent-start.yml` は次を受ける。

- `issues.opened`: Project item を確保し、Status が未設定なら `Backlog` にする。
- `issues.labeled`: `agent-ready` の開始処理を行う。
- `issues.closed`: その Issue に依存する Issue を event-driven で再評価する。
- `workflow_dispatch`: 外部設定導入時の read-only preflight を行う。

開始 guard は次の順で判定する。

1. repository と Project が設定値に一致する。
2. `agent-ready` を最後に付けた actor が `yuto90` である。
3. Issue が open である。
4. `agent-ready` があり、`agent-cancel` がない。
5. Status が `Backlog` または未設定である。
6. GitHub Issue dependencies がすべて closed である。
7. dispatch marker がまだない。
8. 対応する Agent-managed PR がまだない。

通過時だけ `CURSOR_AGENT_ORCHESTRATOR_PAT` を使って `yuto90` 名義の `@cursor` comment を一度投稿する。Status と `agent-ready` は Draft PR ACK まで変更しない。

dispatch comment は Cursor skill と同じ contract を明示する。

- `cursor/issue-<number>-<slug>` branch を作る。
- 必要なら `git commit --allow-empty` を使い、早期に Draft PR を作る。
- PR base は `main`、本文に `Fixes #N` を入れる。
- Project Status、`agent-ready`、`agent-cancel` を Agent が変更しない。
- 重要判断は PR 上の Human Input protocol で停止する。
- 実装、必要なテスト、セルフレビュー、ready marker、`gh pr ready` まで行う。
- merge は行わない。

未完了 dependency がある場合は comment せず、`agent-ready` を残す。dependency が close した `issues.closed` event で GitHub の reverse-dependency endpoint から対象 Issue を得て、同じ guard を再評価する。この再評価では Issue event/timeline から最新の `agent-ready` 付与者が `yuto90` であることを再確認する。定期 polling は行わない。

dispatch comment 後に Draft PR が作成されなくても自動 retry や timeout polling は行わない。marker により workflow rerun も二重 dispatch しない。人間は Issue/Actions/Cursor UI を確認し、必要なら Issue 上で手動の `@cursor` を行う。

## Draft PR ACK

`agent-pr-created.yml` のファイル名は仕様どおり維持するが、機密 token を PR branch の workflow と混在させないため、event は `pull_request_target: opened` を使う。

妥当な ACK の条件は次のとおりである。

1. base が `main`。
2. PR が Draft。
3. head branch が `cursor/` で始まる。
4. closing issue reference が同一 repository の Issue 一つだけを指す。
5. Issue が open で `agent-ready` を持つ。
6. Issue に Orchestrator の dispatch marker がある。
7. Issue が `Cancelled` ではない。

通過時だけ `agent-ready` を削除し、Project Status を `In Progress` にする。検証に失敗した PR は Agent session として ACK せず、Issue は `Backlog` のままにし、workflow summary に理由を記録する。

`pull_request_target`、`workflow_run` などの privileged workflow は PR branch を checkout しない。共通 Orchestrator は必ず default branch の trusted ref から checkout し、PR の title、body、branch、comment を shell command に展開しない。

## Human Input と再開

Agent は重要な判断が必要な場合、対応 PR に `<!-- agent:human-input -->` と次を投稿する。

1. 判断事項
2. 判断できない理由
3. 選択肢
4. 各 Pros / Cons
5. 推奨案
6. 求める回答

`agent-comments.yml` は Agent-managed PR と marker を確認して `Human Input` にする。自然言語分類は行わない。

人間の再開 comment は次をすべて満たす場合だけ状態へ反映する。

- author が `yuto90`
- 対応 PR 上の comment
- standalone mention として `@cursor` を含む
- current Status が `Human Input`、`Blocked`、`Rework` のいずれか
- `agent-cancel` がない

GitHub Actions は comment を Cursor へ転送・複製せず、Status を `In Progress` にするだけである。GitHub 上の元 comment を Cursor GitHub integration が受け取り、同じ session を再開する。

## CI 自動修正

`agent-ci.yml` は `workflow_run.completed` を受け、workflow 名が `Pull Request CI` のときだけ処理する。

1. `workflow_run.pull_requests` から同一 repository の open PR を解決する。
2. Agent-managed PR か確認する。
3. run の `head_sha` が現在の PR head SHA と一致するか確認する。
4. 同じ head SHA の最新 run か確認する。
5. `Cancelled` または `Done` なら何もしない。

失敗時は、直近の成功 run より後にある retry marker を数える。

```text
failure -> Retry 1 comment
failure -> Retry 2 comment
failure -> Retry 3 comment
failure -> Blocked
```

つまり自動修正依頼は最大 3 comments、4 回目の連続失敗で `Blocked` にする。run ID と head SHA の marker で rerun を重複処理しない。current-head CI が成功したら連続失敗 count は実質的に reset されるため、後の Rework は新しい failure cycle として扱う。

CI 修正 comment は `yuto90` 名義で対応 PR に投稿し、失敗した job と Actions run URL を案内する。Actions 自身は PR code、artifact、ログ本文を実行しない。

## Human Review gate

`Human Review` へ移すには、同じ current head に対して次をすべて満たす。

1. 対応 PR の latest ready comment に `<!-- agent:ready-for-review -->` があり、同じ comment の SHA marker が current head と一致する。
2. `Pull Request CI` の current-head 最新 run が `success`。
3. PR が Draft ではない。
4. PR が open。
5. Status が `In Progress` または `Rework`。
6. `agent-cancel` がない。

ready marker が先でも CI success が先でも成立するよう、`agent-comments.yml` と `agent-ci.yml` の双方から同じ pure gate を評価する。Agent の `create-pr` skill は race を減らすため、local verification、push、`gh pr ready`、ready marker の順を要求する。

CI Green だけ、PR Ready 化だけ、ready marker だけでは遷移しない。ready comment は直近の Human Input、accepted resume comment、changes requested review より後に投稿されたものだけを有効とし、過去の review cycle の marker を再利用しない。

## Review と Rework

`agent-review.yml` は `pull_request_review.submitted` を受け、次の場合だけ `Human Review -> Rework` にする。

- Agent-managed PR
- reviewer が `yuto90`
- review state が `changes_requested`
- Issue が terminal state でない

人間が続けて同じ PR に `@cursor` comment を投稿すると、`agent-comments.yml` が `Rework -> In Progress` にする。同じ Agent が修正し、再度 Human Review gate を満たせば `Human Review` に戻る。

approve review だけでは Status を変更しない。merge は人間が GitHub UI で行う。

## Merge と Done

`agent-merge.yml` は次の二つの event を扱う。

- `pull_request_target.closed`: PR が `main` へ merged されたか確認する。
- `issues.closed`: Issue close が PR event より後に伝播した場合に再評価する。

GitHub GraphQL closing references で PR と Issue の関係を検証し、次の両方が確認できた場合だけ `Done` にする。

```text
PR merged into main
+
linked Issue closed
```

PR closeだけ、未merge、別branchへのmerge、Issueの手動closeだけでは `Done` にしない。`Fixes #N` による GitHub 標準の Issue close を使い、Actions は Issue を強制 close しない。

PR merge event と Issue close event の順序に依存しないため、polling は不要である。

## Cancel

`agent-cancel.yml` は `issues.labeled` で `agent-cancel` を検知する。

- label actor が `yuto90`
- Issue が Agent-managed または `agent-ready` を持つ
- current Status が terminal でない

を確認し、Status を `Cancelled` にする。以後、全 workflow は terminal guard により CI retry、Human Input 復帰、review、merge 後 Done を含む自動 mutation を行わない。

初期版は Cursor Agent の強制 Kill を要件にしない。必要なら人間が Cursor UI で状況を確認する。

## 認証と最小権限

### `GITHUB_TOKEN`

read-only API 用に workflow ごとに明示する。

```yaml
permissions:
  actions: read
  contents: read
  issues: read
  pull-requests: read
```

### `CURSOR_AGENT_ORCHESTRATOR_PAT`

Actions secret に保存する `yuto90` の fine-grained PAT。resource owner と repository を限定し、有効期限を有限にする。

必要権限は次に限定する。

- Repository access: `seikatu-gakari/volunty` only
- Metadata: read（暗黙）
- Issues: read/write
- Organization Projects: read/write

PR comment は Issues comment API を使うため、初期版の Orchestrator に Contents write、Actions write、Administration、Secrets、Deployments、本番環境権限、Pull Requests write は与えない。PR と Actions の read は scoped `GITHUB_TOKEN` を利用する。

PAT は Orchestrator の API mutation にだけ渡し、Cursor Cloud Environment、PR branch、build、test、artifact、Vercel には渡さない。secret 値を log や workflow summary に出さない。

PAT の作成と Actions secret 保存は、`yuto90` 名義でコメント・Project 更新を行える永続的な権限付与である。実行時に対象、権限、有効期限、影響を提示し、明示確認を得てから Chrome で設定する。

## Project API

- GitHub Projects REST API の GA endpoint と API version `2026-03-10` を使用する。
- organization、Project number、Status field、option 名から毎回 ID を解決する。
- item がなければ一度だけ追加し、既に存在すれば同じ item を再利用する。
- Status mutation 直前に current Status と terminal state を再取得する。
- Issue/PR closing reference の検証には GitHub GraphQL の正式 field を利用する。
- API の rate limit、403、404、409、422 は分類し、部分成功を隠さず Actions summary に残す。

Project ID や option ID を secret または source code に固定しないため、Project option の rename 後も名前 contract で検出できる。

## 冪等性と競合制御

各 handler は `read -> decide -> re-read -> mutate` で動く。

- dispatch marker があれば再度 `@cursor` しない。
- CI run marker があれば同じ run を再処理しない。
- Status が既に target なら API update しない。
- terminal state は上書きしない。
- current PR head と異なる CI/review/comment event は無視する。
- event 対象が Agent-managed Issue/PR でなければ何もしない。
- workflow rerun、GitHub の event redelivery、API retry を前提にする。

workflow concurrency は repository と Issue/PR number を key にし、`cancel-in-progress: false` とする。別 workflow 間の完全な lock には依存せず、mutation 直前の再取得を最終防衛線にする。

repository 全体を対象とする global concurrency limit は設けない。複数 Issue の並列数は、人間が同時に付与する `agent-ready` の数で管理する。

## Actions のセキュリティ

- privileged workflow は default branch の Orchestrator だけを checkout する。
- `pull_request_target` で PR head を checkout しない。
- `workflow_run` で untrusted artifact や PR code を実行しない。
- Issue title/body、PR body、comment、branch 名を shell へ直接展開しない。
- event payload は `GITHUB_EVENT_PATH` から Node.js で JSON として読む。
- third-party Action を増やさず、`actions/checkout` と Node.js 標準 API を中心にする。
- workflow の `permissions` を job ごとに最小化する。
- fork PR、別 repository、別 base branch は Agent-managed session として扱わない。

## Cursor skills

### `architecture`

- `AGENTS.md` と関連する `.agent-shared/skills`、設計書、既存実装を先に読む。
- Issue scope と Acceptance Criteria を満たす最小設計を選ぶ。
- Issue 内で判断できる設計は自律的に進め、重大判断だけ Human Input にする。

### `implementation`

- 型安全、Server/Client 境界、既存ディレクトリ、既存 pattern を守る。
- Issue に必須でない追加課題は現在の PR に混ぜず、別 Issue を作る。
- 新規 Issue へ `agent-ready` を自動付与しない。
- `main` へ直接 push・merge しない。

### `testing`

- `volunty-test-completion-gate` と変更範囲から UT/E2E 追加要否を判断する。
- 最低限 lint、UT、`npm run build -- --webpack` を変更範囲に応じて行う。
- E2E は必要性と実行場所を明記し、CI の `Pull Request CI` を最終判定に含める。

### `code-review`

- correctness、security、認可、回帰、型安全、テスト不足、不要差分をセルフレビューする。
- review 指摘は根拠を確認し、同じ PR branch で修正する。

### `human-escalation`

- データ削除、課金、認証・認可、セキュリティ、破壊的 migration、Acceptance Criteria 変更、大きな trade-off、外部コスト、重大な仕様矛盾では推測しない。
- `<!-- agent:human-input -->` と選択肢、Pros/Cons、推奨案を PR に投稿し、依存する作業を止める。

### `create-pr`

- `cursor/*` branch を作り、必要なら empty commit で早期 Draft PR を作る。
- base は `main`、本文は `Fixes #N` を一つ含む。
- local verification と push 後に `gh pr ready` を行い、最後に ready marker を投稿する。
- Project Status や Agent labels を変更せず、merge しない。

### `fix-ci`

- Actions run URL と current head を確認し、失敗の根本原因を修正する。
- symptom を隠す test skip や型安全性低下で通さない。
- 必要な検証後に同じ PR branch へ push する。
- 新規 PR や新規 Agent session を作らない。

## テスト設計

共通 Orchestrator の判断ロジックは副作用のない pure function とし、Node.js 標準 `node:test` で fixture event と fake GitHub API を検証する。

### 必須 unit/contract tests

- operator、repository、label、terminal state の guard
- dependency が open/closed の start 判定と close 後の再評価
- dispatch marker と PR ACK の二重処理防止
- exact Human Input / ready marker 判定
- Human Input、Blocked、Rework からの `@cursor` 復帰
- PR branch、Draft、base、closing Issue の ACK 条件
- stale head、古い workflow run、run redelivery の無視
- CI retry 1〜3 と 4 回目 Blocked、success 後 reset
- marker と CI event の順序を問わない Human Review gate
- changes requested の Rework と unauthorized reviewer の無視
- merged + closed の event 順序を問わない Done
- Cancelled/Done の terminal guard
- Project field/option 不足時の fail-closed
- GitHub API error と partial failure の summary

### repository verification

- `node --test .github/scripts/agent-orchestrator/*.test.mjs`
- workflow YAML の static validation
- `cd app && npm run lint`
- `cd app && npm test`
- `cd app && npm run build -- --webpack`
- 変更がアプリ動作に影響しない場合でも既存 CI を PR 上で完走させる
- `volunty-test-completion-gate` で E2E の追加要否を判定する

### live smoke test

default branch へ workflow が入った後、低リスクの docs-only 検証 Issue を一つ作り、次を確認する。

1. `agent-ready` から `yuto90` の `@cursor` comment が一度だけ投稿される。
2. Cursor が同じ Issue の Draft PR を作り、`In Progress` になる。
3. Human Input comment と `yuto90` の PR 回答で同じ session が再開する。
4. ready marker、PR Ready、current-head CI Green で `Human Review` になる。
5. 人間の changes requested と `@cursor` で Rework を同じ session が処理する。
6. 人間の merge で Issue が close し、Project が `Done` になる。

CI retry 上限、stale event、Cancelled は automated contract tests を必須とし、必要なら別の使い捨て Issue で state-only smoke test を行う。意図的な CI 失敗を 4 回発生させることは本番 branch history と Cursor 利用量を増やすため、初期 live smoke の必須条件にはしない。

Cursor 起動は利用量を消費し、Issue/PR/comment/Project を外部へ書き込む。live smoke 実行直前に対象 Issue、想定変更、merge の扱いを提示して明示確認を得る。

## 導入順序

### Phase 1: repository implementation

1. 設計承認後に詳細実装計画を作る。
2. Orchestrator、workflows、Cursor skills、運用文書、tests を専用 branch で実装する。
3. lint、UT、build、static checks を実行する。
4. `main` 向け Ready PR を作り、CI、Vercel Preview、Codex Review を確認する。
5. 人間が内容を確認して merge する。

この段階では GitHub Project、labels、PAT、Cursor UI を変更しない。default branch に workflow がない状態で外部 Control Plane だけを切り替えない。

### Phase 2: external configuration

1. Chrome で PAT の権限と期限を最終確認し、明示承認後に作成する。
2. Chrome で repository Actions secret `CURSOR_AGENT_ORCHESTRATOR_PAT` を保存する。
3. `agent-ready` と `agent-cancel` labels を作る。
4. Project Status option を 8 種類へ migrate する。
5. `agent-start.yml` の manual preflight で Project/PAT/config を read-only 検証する。
6. Status を変更する built-in Project workflows を無効化する。
7. Cursor Environment と GitHub integration の設定を再確認する。

Project migration は実行直前に option と item count を再取得し、設計時の観測と違えば停止する。browser 操作はすべて Chrome を使う。

### Phase 3: acceptance

1. 承認済み live smoke Issue を作成する。
2. happy path、Human Input、Rework、merge/close/Done を観測する。
3. workflow rerun で comment/status が重複しないことを確認する。
4. contract tests と live evidence を運用文書へ記録する。

## Rollback

問題があれば次の順で新規 dispatch を止める。

1. `agent-start.yml` と `agent-ci.yml` を GitHub Actions で disable する。
2. `agent-ready` を新規付与しない。
3. active Issue に必要なら `agent-cancel` を付ける。
4. built-in Project workflow は自動では戻さず、Status history と active item を確認してから個別に復元する。
5. PAT secret を削除し、fine-grained PAT を revoke する。

既存 PR、Issue、Project history、Cursor branch は削除しないため、監査と手動復旧が可能である。

## 対象外

- Cursor API による直接起動、follow-up、強制 Kill
- 自動 merge
- 自動 `agent-ready` 付与
- Repository 横断 orchestration
- Agent 並列数のシステム制御
- 独自 DB、独自 dashboard、独自 audit service
- 新規 Issue の polling、定期 reconciliation
- Issue template の強制
- 本番 Supabase、Vercel、本番 DB の資格情報を Cursor へ渡すこと
- 既存 Draft PR の自動 close または merge

## 公式資料

- [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent)
- [Cursor Cloud Agent capabilities](https://cursor.com/docs/cloud-agent/capabilities)
- [Cursor GitHub integration](https://cursor.com/docs/integrations/github)
- [GitHub Issue dependencies REST API](https://docs.github.com/en/rest/issues/issue-dependencies?apiVersion=2026-03-10)
- [GitHub Projects items REST API](https://docs.github.com/en/rest/projects/items?apiVersion=2026-03-10)
- [GitHub Projects fields REST API](https://docs.github.com/en/rest/projects/fields?apiVersion=2026-03-10)
- [GitHub Actions `workflow_run`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Actions script injection](https://docs.github.com/en/actions/concepts/security/script-injections)

## 設計上の決定

- Cursor を `agent-ready` 標準フローにし、Codex Cloud/Copilot は手動フォールバックとして残す。
- Project Status の自動変更は GitHub Actions だけが行う。
- Project 操作は GA の REST API、PR/Issue closing relation は GitHub GraphQL を使う。
- privileged workflows は trusted default branch code だけを実行する。
- Draft PR を起動 ACK、PR を同一 Agent session とする。
- CI 修正 comment は最大 3 回、4 回目の連続失敗で Blocked とする。
- `Done` は merged + closed の両条件、`Cancelled` と `Done` は terminal state とする。
- 通常運用に polling、独自 DB、自動 merge を導入しない。
- repository 実装を人間が merge した後に外部設定を切り替える。
