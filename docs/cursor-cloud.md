# Volunty Cursor Cloud Agent運用手順

Cursor Cloud Agent は、承認済み Issue を `agent-ready` から同じ `cursor/*` branch と同じ Draft PRで実装・検証・Human Review待ちまで進める標準フローです。`main` への merge、外部設定の変更、production操作は人間の責務です。Codex Cloud は `codex/*` の人間開始フローとして並存し、同じ Issue に両方を自動起動しません。共通のPreviewとbranchは[ブランチ運用](branch-workflow.md)、Codexの手順は[Codex Cloud運用手順](codex-cloud.md)を参照してください。

## 有効化停止条件

この節は設定済みの状態を表しません。2026-08-25時点で、Cursor GitHub Appには`workflows: write`があり、public repositoryかつGA機能だけの同一repository運用では、Cursorが第8の危険なworkflowを追加することを防げません。したがって、**Cursor/PATの有効化、`agent-ready`の付与、live smokeは停止中**です。

加えて、`Pull Request CI`は既存`main`の`pull_request`から安全な`pull_request_target`へ二段階で移行します。PR #217ではbootstrap gapを避けるため、同じ`opened` / `synchronize` / `reopened` / `ready_for_review`、base `main`の両triggerを一時的に宣言します。bridge中は同じPR headに重複CIが生じる場合がありますが、jobの`contents: read`、same-repository guard、明示PR head checkout、secret/cacheなしの境界は変えません。PR #217を人間がmergeした直後、follow-up cleanup PRで`pull_request`をworkflow・契約test・文書から削除してtarget-onlyへ戻し、人間がmergeしてremote CIを確認します。これは永続仕様ではなく、**この2本目のcleanup merge前にProject/PAT/Cursorを一切有効化してはいけません**。

人間は次のいずれか一つを選び、その有効状態をGitHub/Cursor UIで再読・live verificationしてからだけ有効化できます。選ばれていない案を設定済みとして扱ってはいけません。

| 選択肢 | 選択・live verificationが必要な安全境界 |
| --- | --- |
| A | public previewの[Workflow Execution Protections](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/actions-policies/workflow-execution-protections)でactor/event allowlistを有効にする。ただしこれはGA-only方針と明示的に両立しない。さらに`Production DB Migration`を、untrusted pushとrepository secretに依存しない経路へ別設計・別変更で移行する。 |
| B | repositoryをprivateまたはinternalへ変更し、GitHub Team以上のpush rulesetで`.github/workflows/**`を保護する。[push rulesetのpath restriction](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)が実際に有効で、Cursorを含む不適切なbypassがないことを確認する。 |
| C | publicかつGA-onlyを維持し、sandbox/fork方式へ再設計する。この場合は同一repositoryのCursor Agentを有効化しない。 |

現行の[Production DB Migration](../.github/workflows/production-db-migrate.yml)は`main` pushでrepository Actions secretを使うため、上の有効化停止条件に対する**pre-activation noncompliance**です。このTaskではworkflowもsecretも変更しません。選択肢Aでは特に、このproduction DB経路を先にremediateしなければなりません。

`pull_request_review` trigger、review artifact、artifact consumerは追加しません。PR branch由来のworkflowをreview安全境界にせず、reviewは下記のdefault-branch manual reconciliationまたは`yuto90`のPR `@cursor`でだけ反映します。GitHub Actionsの[secure use](https://docs.github.com/en/actions/reference/security/secure-use)と[script injection対策](https://docs.github.com/en/actions/concepts/security/script-injections)を維持してください。

## Cursor Environment

既存の`seikatu-gakari/volunty` Environmentを使います。これは設定手順であり、実行済みを意味しません。

| 項目 | 設定 |
| --- | --- |
| Runtime | Node.js 22 |
| Install | `cd app && npm ci --no-audit && npm run db:generate` |
| branch prefix | `cursor/` |
| PR作成 | Single Model Runで有効 |
| 本番secret | 登録しない |

既存Environmentを`.cursor/environment.json`で上書きしません。Cursor CloudはローカルMacの`.cursor/mcp.json`やlocal MCP processに依存せず、必要なMCP/外部連携はCloud側でread-onlyまたは非本番の最小権限に限定します。ローカルのnative MCP設定は維持します。PAT、production DB、production service、Vercel tokenをCursor Cloud、PR branch、build、test、artifactへ渡しません。

## Orchestratorの構成

次の**7本だけ**がAgent Orchestrator workflowです。いずれもtrusted default branchをcheckoutし、PR head、untrusted artifact、PR codeをPAT-bearing workflowで実行しません。

| workflow | ファイル | 用途 |
| --- | --- | --- |
| Agent Orchestrator - Start | `.github/workflows/agent-start.yml` | Issue open/label/closeとmanual preflight。guard通過後に一度だけdispatch |
| Agent Orchestrator - Draft PR ACK | `.github/workflows/agent-pr-created.yml` | `cursor/*` Draft PRをACKし、`In Progress`へ遷移 |
| Agent Orchestrator - Comments | `.github/workflows/agent-comments.yml` | Human Input marker、`yuto90 @cursor`再開、Ready gate |
| Agent Orchestrator - CI | `.github/workflows/agent-ci.yml` | fixed-path `Pull Request CI` completedを評価し、retry・Blocked・Ready gate |
| Agent Orchestrator - Review Reconciliation | `.github/workflows/agent-review.yml` | `main`上のoperator-only manual review reconciliation |
| Agent Orchestrator - Merge Convergence | `.github/workflows/agent-merge.yml` | main mergeとlinked Issue closeを収束し`Done`へ遷移 |
| Agent Orchestrator - Cancel | `.github/workflows/agent-cancel.yml` | `agent-cancel`付与を確認して`Cancelled`へ遷移 |

`pull_request_target` workflowを実行中の`GITHUB_SHA`はbase branchのcommitだが、Actions REST / `workflow_run` eventのtop-level `head_branch` / `head_sha` / `head_repository`はPR head branch、当該runのhistorical PR head SHA、head repositoryを表す。両者を同じmetadataとして扱ってはいけない。実APIでは`pull_requests`が空のtarget runがあり、relationがあるold runでも`head.sha`がcurrent PR headへ更新され得る。`agent-ci.yml`はEnvironment/PATをmaterializeする前にtop-levelのsame-repository `cursor/*` headをguardし、handlerはtrusted `head=owner:branch` REST queryでexactly oneのopen PRを解決してcurrent SHAを照合する。CI履歴もfixed workflow、branch、eventで検索し、historical SHAはrelationではなく各runのtop-level `head_sha`を使う。同名branchのfork runや削除済みforkで`head_repository`が欠落したrunは対象外にする。

7本はすべて同一のrepository-wide concurrency group `agent-orchestrator-${{ github.repository }}`、`queue: max`、`cancel-in-progress: false`を使い、異なるevent入口から同じProject itemを同時にmutationしません。同じgroupは最大100のpending runを保持し、waiting開始順にFIFOで実行開始しますが、eventのdispatch順そのものは保証しません。100を超えたpending runはcancelされ得るため永続event queueとは扱わず、各handlerはGitHub上の正本をmutation直前に再取得し、redeliveryに冪等に収束します。Cursor Agentの並列数は人間が`agent-ready`で別に管理し、dependency再評価はevent-drivenのままとしてpollingやcustom orchestratorを追加しません。

fixed markerは自然言語で代用しません。動的なIssue番号、run ID、SHAは実際の値に置き換え、次の形式以外を信頼しません。

```html
<!-- agent:dispatch:v1 issue=123 -->
<!-- agent:human-input -->
<!-- agent:ready-for-review -->
<!-- agent:ready-for-review:v1 head_sha=0123456789abcdef0123456789abcdef01234567 -->
<!-- agent:ci-retry:v1 run_id=123456 head_sha=0123456789abcdef0123456789abcdef01234567 retry=1 -->
```

dispatch markerはOrchestratorが`yuto90`名義でIssueに投稿します。Human Input/Ready markerはAgentが対応PRに投稿し、Readyは必ず同じcomment内の2行とcurrent full HEAD SHAで判定します。CI retry markerはOrchestratorがPRに投稿します。AgentはProject、Status、`agent-ready`、`agent-cancel`を変更せず、同じsession/branch/PRを継続して人間mergeを待ちます。

### Cursor skills

Cursor Cloudは次の7 skillを使います。skillの名前・契約を変更して運用上の制約を回避しません。

| skill | 責務 |
| --- | --- |
| `architecture` | 根拠を確認し、未確定の重大判断はHuman Inputへ回す |
| `implementation` | Issue/AC内だけを型安全に実装し、Project/labelを変更しない |
| `testing` | `volunty-test-completion-gate`でUT/E2EとCI証拠を判定する |
| `code-review` | correctness、security/authz、回帰、型、テスト不足、不要差分を確認する |
| `human-escalation` | exact Human Input markerと判断材料をPRへ投稿して依存作業を止める |
| `create-pr` | 同一`cursor/*` branchで早期Draft PR、Ready化、current-head markerを管理する |
| `fix-ci` | 同じsession/branch/PRでcurrent CI failureを根本修正する |

## Project、label、状態の準備

対象は`seikatu-gakari`のProject `#2`です。ProjectのStatus変更はOrchestratorだけが行い、Cursor Agentやbuilt-in workflowには行わせません。

### Status option migration

実行直前にoption名とitem数を再読し、次と異なれば変更せず停止します。移行後は**8種類のみ**で、`Ready`は残しません。

| 現在 | 移行後 | 操作 |
| --- | --- | --- |
| `Backlog` | `Backlog` | 維持 |
| `Ready` | `Human Input` | rename。先に対象item数を確認 |
| `In progress` | `In Progress` | rename |
| `In review` | `Human Review` | rename |
| `Done` | `Done` | 維持 |
| なし | `Rework` | 追加 |
| なし | `Blocked` | 追加 |
| なし | `Cancelled` | 追加 |

次のbuilt-in workflowは維持します。

- open Issueのauto-add
- sub-issueのauto-add

次の5本はmanual preflight成功後に無効化します。

- item added -> Backlog
- item closed -> Done
- PR linked -> In progress
- PR merged -> Done
- Status Done -> Issue close

### Labels

| label | 色 | 説明 |
| --- | --- | --- |
| `agent-ready` | `0E8A16` | `yuto90`が確認済みのIssueをCursor Cloud Agentへ一度だけdispatchしてよいことを示す。Agent自身は付与・削除しない。 |
| `agent-cancel` | `B60205` | `yuto90`がactiveなAgent処理を論理停止するためのlabel。Cursor processを強制killせず、terminal `Cancelled`へ遷移する。 |

### Status transition

| From | Event / guard | To |
| --- | --- | --- |
| Statusなし | 新規IssueをProjectへ登録 | `Backlog` |
| `Backlog` | 妥当な`cursor/*` Draft PRのopened ACK | `In Progress` |
| `In Progress` / `Rework` | Agentの`<!-- agent:human-input -->` | `Human Input` |
| `Human Input` / `Blocked` / `Rework` | `yuto90`の対応PR上standalone `@cursor` comment | `In Progress` |
| `In Progress` / `Rework` | current-head Ready marker + current-head CI success + PR非Draft | `Human Review` |
| `Human Review` | manual reconciliationで`yuto90`の最新`changes_requested`を確認 | `Rework` |
| `Human Review` | 同reviewの後に`yuto90 @cursor`を確認 | `Rework`を経由して`In Progress` |
| active state | `yuto90`が`agent-cancel`を付与 | `Cancelled` |
| active state | main mergeとlinked Issue closeの両方を確認 | `Done` |

`Done`と`Cancelled`はterminalです。後続eventで上書きしません。`Cancelled`でもCursor processの強制killは行わず、必要なら人間がCursor UIを確認します。

## PATとGitHub Environment

`CURSOR_AGENT_ORCHESTRATOR_PAT`は`yuto90`のfine-grained PATです。事前承認、上のsecurity gate、default branchへのworkflow merge後にだけ作成・rotationします。値をchat、Issue、PR、ログ、設定ファイルへ書かず、repository Actions secretには**絶対に保存しません**。

| 項目 | 正確な設定 |
| --- | --- |
| Resource owner | `seikatu-gakari` |
| Repository access | `seikatu-gakari/volunty` only |
| Metadata | read（暗黙） |
| Repository permissions | Issues: read/write |
| Organization permissions | Projects: read/write |
| 与えない権限 | Contents write、Actions write、Administration、Secrets、Deployments、本番環境権限、Pull requests write |
| 有効期限 | 無期限にせず、運用者が記録・reviewできる有限期限 |
| 保存先 | GitHub Environment `agent-orchestrator` のsecret `CURSOR_AGENT_ORCHESTRATOR_PAT`のみ |
| Deployment branch policy | selected branch `main` only。保存前と保存後に`main`一件だけであることを再読 |

PATはOrganization ProjectのGET、Issue comment・labelのmutation、Project item/Statusのmutationにだけ渡します。RepositoryのIssue/PR/Actionsのreadはworkflowのscoped `GITHUB_TOKEN`を使います。rotation時は新PATを作る前に対象・権限・有限期限・`yuto90`名義のmutation影響を明示承認し、Environmentの名前・`main` only policy・secret名を再読してから旧PATをrevokeします。token文字列を表示・貼付・検証ログに出しません。

## 導入preflight

この順序は外部設定のチェックリストであり、現時点で設定済みとは主張しません。

1. この文書の選択肢A/B/Cから一つを人間が選び、該当security controlとproduction DB remediationをlive verificationする。完了前は以降を実行しない。
2. PR #217を人間がmergeし、default branchに一時的な両CI trigger、7 workflow、Orchestrator、Cursor skills、運用文書が存在することを確認する。
3. follow-up cleanup PRで`pull_request` triggerを削除してtarget-only契約・test・文書へ戻し、人間がmergeした後、remote `pull_request_target` CIを確認する。2本のPRがmergeされる前は外部設定へ進まない。
4. GitHub Environment `agent-orchestrator`を作成または再確認し、selected branch `main` onlyを保存して再読する。
5. 明示承認後、最小権限・有限期限のPATを作り、Environment secret `CURSOR_AGENT_ORCHESTRATOR_PAT`としてのみ保存する。Environment名、policy、secret名を再読する。
6. 上記2 labelを作成し、Project optionとitem countを再読して8 Statusへmigrateする。
7. `Agent Orchestrator - Start`を`main` refからmanual実行し、read-only preflightのsummaryでrepository、Project、Statusの一意性を確認する。このpreflightはmutationしないが、Organization Project GETのためにEnvironment secretのPAT認証を使う。workflow inputやログにPAT値を入力・表示しない。
8. preflight成功後にだけ、Statusを変える5本のbuilt-in Project workflowを無効化する。
9. Cursor UIでrepository、Node 22、install command、`cursor/` prefix、GitHub integration、PR creation、production secret不在、Cursor Appの実権限を再読する。`workflows: write`が残ることを前提に、選んだA/B/Cの安全境界が有効であることを確認する。

## 日常運用

### 通常の開始からHuman Reviewまで

1. 人間はopen Issueに要件、受け入れ条件、dependencyを記録し、同時に起動する数を自ら管理する。
2. `yuto90`が`agent-ready`を付ける。Orchestratorはlabel付与者、open state、dependency、`Backlog`、既存dispatch marker、既存managed PRを検証する。
3. guard通過後だけ、`yuto90`名義のmarker付き`@cursor` commentを一度だけ投稿する。Draft PR ACKまでは`agent-ready`を残し、Statusは`Backlog`のままである。
4. Cursorは`cursor/issue-<number>-<slug>` branchと早期Draft PRを作り、本文に同一repository Issue一つだけの`Fixes #<number>`を入れる。ACKが妥当ならOrchestratorは`In Progress`へ変更して`agent-ready`を削除する。
5. Cursorは同じPRで実装、必要なテスト、セルフreview、push、`gh pr ready`、current HEADのReady markerを順に行う。`Pull Request CI`の同じHEADがsuccessかつPRがnon-Draftなら`Human Review`になる。
6. Human Reviewとrequired checksの確認後、人間だけがGitHub UIでmergeする。main mergeとlinked Issue closeの両方で`Done`になる。

dispatch後にDraft PRが作られなくても、Orchestratorはauto retryやpollingをしません。人間はIssue、Actions、Cursor UIを確認し、必要ならIssue上で手動の`@cursor`を行います。

### Human Input、Blocked、Rework

- **Human Input:** Agentは対応Draft PRに`<!-- agent:human-input -->`を一度投稿し、判断事項、理由、選択肢、各Pros/Cons、推奨案、求める回答を記す。依存作業を停止する。`yuto90`が同じPRへstandalone `@cursor`を投稿すると、`Human Input`、`Blocked`、`Rework`から`In Progress`へ戻る。Actionsはcommentを複製せず、Cursor GitHub integrationが同じsessionへ届ける。
- **Blocked:** current HEADの連続CI failureでは、Orchestratorが最大3回だけrun URLとretry marker付きの修正依頼を投稿する。4回目の連続failureで`Blocked`にする。人間は原因を確認し、同じPRにstandalone `@cursor`を投稿して再開する。Cursorは新branch/new PRを作らず、最新current-head runを確認してから修正する。
- **Rework:** `Human Review`中の`yuto90`の最新current-head `changes_requested`は、`Agent Orchestrator - Review Reconciliation`を`main` refからmanual実行し、正の整数のPR番号を渡して反映する。workflowは`yuto90`が開始・rerunした場合だけ動く。あるいは同reviewより後に同じPRで`yuto90`がstandalone `@cursor`を投稿すると、authoritative reviewを再確認して`Human Review -> Rework -> In Progress`へ収束する。approve reviewだけではStatusを変更しない。

### Cancel

`yuto90`がactiveなAgent Issueに`agent-cancel`を付けると、Orchestratorはactor、managed Issue、non-terminal stateを確認して`Cancelled`へ遷移します。以後はdispatch、retry、Human Input復帰、review、Doneへの自動mutationをしません。branch、PR、Issue、historyを削除せず、Cursorの強制killもしません。

## インシデント停止、復旧、token revoke

異常なdispatch、secret到達、workflow改変、Status driftが疑われたら、まず新規dispatchを止めます。

1. GitHub Actionsで`Agent Orchestrator - Start`と`Agent Orchestrator - CI`をdisableする。
2. `agent-ready`を新規付与しない。active Issueは必要に応じて`agent-cancel`を付ける。
3. Environment `agent-orchestrator`から`CURSOR_AGENT_ORCHESTRATOR_PAT`を削除し、対応するfine-grained PATをrevokeする。repository Actions secretへ移して代用しない。
4. Project Status history、active item、Actions run、PR/Issue markerを調査してから、必要なitemだけを人間が復旧する。built-in workflowを一括で戻さない。
5. root causeと選択したA/B/Cのcontrolをlive verificationし、必要なrepository変更が`main`へreview済みでmergeされた後、上のpreflightを最初からやり直す。

既存PR、Issue、Project history、Cursor branchは削除しないため、監査と手動復旧ができます。

## 公式資料

- [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent)
- [Cursor Cloud Agent capabilities](https://cursor.com/docs/cloud-agent/capabilities)
- [Cursor GitHub integration](https://cursor.com/docs/integrations/github)
- [GitHub Workflow Execution Protections](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/actions-policies/workflow-execution-protections)
- [GitHub rulesetsの利用可能なrule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub Actions `workflow_run`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
