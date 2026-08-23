# GitHub Projects × Cursor Cloud Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Issue の `agent-ready` から Cursor Cloud Agent を起動し、GitHub Project の8状態、同一PR session、CI自動修正、Human Input、Rework、Cancel、merge後DoneをGitHub Actionsだけで決定論的に管理する。

**Architecture:** Node.js 22標準機能だけで動く共通Orchestratorを、pureな状態判定、GitHub API adapter、Project adapter、event handlerへ分割する。7つのGitHub Actions workflowはtrusted default branchから共通CLIを実行する薄い入口とし、永続状態と冪等性markerはGitHub上だけに保存する。

**Tech Stack:** Node.js 22 ESM、`node:test`、GitHub Actions、GitHub REST API `2026-03-10`、GitHub GraphQL、Cursor Cloud Agent skills、Markdown。

**Spec:** `docs/superpowers/specs/2026-08-23-github-projects-cursor-agent-orchestration-design.md`

## Global Constraints

- Production ArchitectureはGA機能だけを利用する。
- repositoryは`seikatu-gakari/volunty`、Projectはorganization Project `#2`、default branchは`main`。
- operatorは`yuto90`だけ、Cursor branch prefixは`cursor/`。
- Statusは`Backlog`、`In Progress`、`Human Input`、`Human Review`、`Rework`、`Blocked`、`Done`、`Cancelled`の8種類で、`Ready`は使用しない。
- Project Statusを変更する自動化はGitHub Actionsだけとする。
- `Done`と`Cancelled`はterminal stateで、Agentは`main`をpush/mergeしない。
- CI修正commentは最大3回、4回目の連続失敗で`Blocked`。
- privileged workflowはPR head code/artifactを実行せず、trusted default branchだけをcheckoutする。
- package依存を追加せず、`unknown`相当の外部入力をruntime validatorで絞り込む。
- 本番DB、Supabase service role、OAuth、Vercel tokenをCursor Cloudへ登録しない。
- コミットはConventional Commits、日本語の説明とする。

---

### Task 1: Orchestrator設定とpure state policy

**Files:**
- Create: `.github/agent-orchestrator.json`
- Create: `.github/scripts/agent-orchestrator/config.mjs`
- Create: `.github/scripts/agent-orchestrator/core.mjs`
- Test: `.github/scripts/agent-orchestrator/config.test.mjs`
- Test: `.github/scripts/agent-orchestrator/core.test.mjs`

**Interfaces:**
- Produces: `loadConfig(path): AgentConfig`
- Produces: `isTerminalStatus(status): boolean`
- Produces: `hasExactMarker(body, marker): boolean`
- Produces: `parseReadyHeadSha(body): string | null`
- Produces: `parseRetryMarker(body): {runId:string, headSha:string, retry:number} | null`
- Produces: `hasStandaloneCursorMention(body): boolean`
- Produces: `evaluateStart(context): Decision`
- Produces: `evaluatePrAck(context): Decision`
- Produces: `evaluateHumanReview(context): Decision`
- Produces: `evaluateReview(context): Decision`
- Produces: `evaluateDone(context): Decision`
- Produces: `evaluateCancel(context): Decision`

- [ ] **Step 1: Write failing config and marker tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasStandaloneCursorMention,
  parseReadyHeadSha,
  parseRetryMarker,
} from './core.mjs';

test('standalone @cursorだけを人間の再開命令として認識する', () => {
  assert.equal(hasStandaloneCursorMention('@cursor\n再開してください'), true);
  assert.equal(hasStandaloneCursorMention('mail@cursor.example'), false);
});

test('ready markerからcurrent head SHAを取得する', () => {
  const body = '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abc123 -->';
  assert.equal(parseReadyHeadSha(body), 'abc123');
});

test('CI retry markerを厳密にparseする', () => {
  assert.deepEqual(
    parseRetryMarker('<!-- agent:ci-retry:v1 run_id=42 head_sha=abc retry=3 -->'),
    { runId: '42', headSha: 'abc', retry: 3 },
  );
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test .github/scripts/agent-orchestrator/config.test.mjs .github/scripts/agent-orchestrator/core.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `config.mjs` or `core.mjs`.

- [ ] **Step 3: Add exact configuration and runtime validation**

```json
{
  "owner": "seikatu-gakari",
  "repository": "volunty",
  "projectNumber": 2,
  "operator": "yuto90",
  "agentActors": ["yuto90", "cursor[bot]"],
  "labels": { "ready": "agent-ready", "cancel": "agent-cancel" },
  "statuses": ["Backlog", "In Progress", "Human Input", "Human Review", "Rework", "Blocked", "Done", "Cancelled"],
  "ciWorkflow": "Pull Request CI",
  "ciRetryLimit": 3,
  "defaultBranch": "main",
  "cursorBranchPrefix": "cursor/"
}
```

`config.mjs`はJSONのobject、string、positive integer、8 Statusの一意性を検証し、不正値ではfield名を含む`Error`をthrowする。

- [ ] **Step 4: Implement minimal pure policy**

```js
export function evaluateHumanReview({
  status,
  isDraft,
  isOpen,
  headSha,
  latestReady,
  invalidatedAfter,
  ciConclusion,
  cancelled,
}) {
  if (cancelled || isTerminalStatus(status)) return skip('terminal');
  if (!['In Progress', 'Rework'].includes(status)) return skip('invalid-status');
  if (!isOpen || isDraft) return skip('pr-not-ready');
  if (ciConclusion !== 'success') return skip('ci-not-green');
  if (!latestReady || latestReady.headSha !== headSha) return skip('stale-ready-marker');
  if (latestReady.createdAt <= invalidatedAfter) return skip('invalidated-ready-marker');
  return transition('Human Review');
}
```

`Decision`は`{kind:'skip', reason:string}`、`{kind:'transition', status:string}`、`{kind:'dispatch'}`のdiscriminated unionとしてJSDocで定義する。

- [ ] **Step 5: Cover all state boundaries**

Table-driven testsでoperator違反、open dependency、dispatch済み、Draft ACK、terminal state、marker/CI順序、stale SHA、unauthorized review、merged+closed、cancelをliteral expected valuesで検証する。

- [ ] **Step 6: Run tests and commit**

Run: `node --test .github/scripts/agent-orchestrator/config.test.mjs .github/scripts/agent-orchestrator/core.test.mjs`

Expected: PASS.

```bash
git add .github/agent-orchestrator.json .github/scripts/agent-orchestrator/config.mjs .github/scripts/agent-orchestrator/core.mjs .github/scripts/agent-orchestrator/config.test.mjs .github/scripts/agent-orchestrator/core.test.mjs
git commit -m "feat: Agent Orchestratorの状態モデルを追加"
```

### Task 2: GitHub APIとProject adapter

**Files:**
- Create: `.github/scripts/agent-orchestrator/github.mjs`
- Create: `.github/scripts/agent-orchestrator/project.mjs`
- Test: `.github/scripts/agent-orchestrator/github.test.mjs`
- Test: `.github/scripts/agent-orchestrator/project.test.mjs`

**Interfaces:**
- Consumes: `AgentConfig` from `config.mjs`
- Produces: `GitHubClient({readToken, writeToken, fetchImpl, apiVersion})`
- Produces: `client.read(path, options)`, `client.write(path, options)`, `client.graphql(query, variables)`
- Produces: `ProjectStore({client, config})`
- Produces: `resolveProject(): {projectId, statusFieldId, optionIdsByName}`
- Produces: `ensureIssueItem(issueNodeId): ProjectItem`
- Produces: `getIssueStatus(issueNodeId): string | null`
- Produces: `transitionIssue(issueNodeId, target, allowedFrom): Promise<'changed'|'unchanged'>`

- [ ] **Step 1: Write failing HTTP boundary tests**

Use a queue-backed real `fetchImpl` fake that records method, URL, headers, body and returns complete `Response` objects. Assert that read calls use `GITHUB_TOKEN`, mutation calls use the PAT, `X-GitHub-Api-Version: 2026-03-10` is present, and non-2xx errors include status/request ID without response secrets.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test .github/scripts/agent-orchestrator/github.test.mjs .github/scripts/agent-orchestrator/project.test.mjs`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement GitHubClient**

```js
export class GitHubClient {
  constructor({ readToken, writeToken, fetchImpl = fetch, apiVersion = '2026-03-10' }) {
    this.readToken = requireToken(readToken, 'GITHUB_TOKEN');
    this.writeToken = writeToken ?? '';
    this.fetchImpl = fetchImpl;
    this.apiVersion = apiVersion;
  }

  read(path, options = {}) {
    return this.request(path, { ...options, token: this.readToken });
  }

  write(path, options = {}) {
    return this.request(path, { ...options, token: requireToken(this.writeToken, 'CURSOR_AGENT_ORCHESTRATOR_PAT') });
  }
}
```

Add pagination using `Link` headers, GraphQL error validation, JSON/non-JSON error handling, and request timeout through `AbortSignal.timeout(30_000)`.

- [ ] **Step 4: Implement ProjectStore with dynamic IDs**

Resolve organization Project `#2`, list fields, require exactly one `Status` field and all eight option names, list/filter item by Issue node ID, add item idempotently, and PATCH the Status field only after re-reading current status. Treat `Done`/`Cancelled` as terminal and reject a transition not included in `allowedFrom`.

- [ ] **Step 5: Verify error and idempotency cases**

Test duplicate item add (`422` followed by re-read), missing option, duplicate option, already-target status, terminal status, allowed-from mismatch, pagination, `403` and `409`.

- [ ] **Step 6: Run tests and commit**

Run: `node --test .github/scripts/agent-orchestrator/github.test.mjs .github/scripts/agent-orchestrator/project.test.mjs`

Expected: PASS.

```bash
git add .github/scripts/agent-orchestrator/github.mjs .github/scripts/agent-orchestrator/project.mjs .github/scripts/agent-orchestrator/github.test.mjs .github/scripts/agent-orchestrator/project.test.mjs
git commit -m "feat: GitHub Project APIアダプターを追加"
```

### Task 3: Repository gateway、start、Draft PR ACK

**Files:**
- Create: `.github/scripts/agent-orchestrator/repository.mjs`
- Create: `.github/scripts/agent-orchestrator/handlers.mjs`
- Test: `.github/scripts/agent-orchestrator/repository.test.mjs`
- Test: `.github/scripts/agent-orchestrator/start.test.mjs`
- Test: `.github/scripts/agent-orchestrator/pr-created.test.mjs`

**Interfaces:**
- Consumes: `GitHubClient`, `ProjectStore`, pure decisions
- Produces: `AgentRepository({client, config})`
- Produces: `listIssueDependencies(number)`, `listBlockedBy(number)`, `findClosingIssues(prNumber)`, `findClosingPullRequests(issueNumber)`, `listComments(number)`, `postComment(number, body)`, `removeLabel(number, label)`
- Produces: `createHandlers({repository, project, config, summary})`
- Produces: `handleStart(event)`, `handlePrCreated(event)`

- [ ] **Step 1: Write failing start and ACK behavior tests**

Create in-memory repository/project fakes that expose domain behavior, not mock call counts. Assert observable final status/comments/labels for:

- Issue opened -> project item `Backlog`
- authorized `agent-ready` + closed dependencies -> one dispatch comment
- open dependency -> no comment, label retained
- latest label event by another actor -> no dispatch
- rerun with dispatch marker -> no duplicate
- Draft `cursor/*` PR + exactly one closing Issue -> label removed + `In Progress`
- non-Draft, wrong base, no dispatch marker, multiple closing Issues -> unchanged

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test .github/scripts/agent-orchestrator/start.test.mjs .github/scripts/agent-orchestrator/pr-created.test.mjs`

Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement Repository gateway**

Use REST issue-dependency endpoints, issue events for latest label actor, issue comments for markers/commands, and GraphQL `closingIssuesReferences` / `closedByPullRequestsReferences`. Validate every returned object before use and reject cross-repository relationships.

- [ ] **Step 4: Implement start handler**

The dispatch comment must contain `<!-- agent:dispatch:v1 issue=N -->`, `@cursor`, early Draft PR instructions, `cursor/issue-N-slug`, `Fixes #N`, Human Input protocol, verification, `gh pr ready`, ready marker, and no merge/status mutation rule.

On `issues.closed`, call `listBlockedBy(closedNumber)` and re-evaluate only open Issues still carrying `agent-ready`; verify the latest label actor from Issue events is `yuto90`.

On `workflow_dispatch`, resolve config/project/status fields and issue a read-only summary without adding items, comments, labels or status.

- [ ] **Step 5: Implement PR ACK handler**

Validate base, Draft, branch prefix, one closing Issue, open state, label, dispatch marker and non-terminal status; then remove `agent-ready` and transition `Backlog -> In Progress`. Re-read terminal/status before each mutation.

- [ ] **Step 6: Run tests and commit**

Run: `node --test .github/scripts/agent-orchestrator/repository.test.mjs .github/scripts/agent-orchestrator/start.test.mjs .github/scripts/agent-orchestrator/pr-created.test.mjs`

Expected: PASS.

```bash
git add .github/scripts/agent-orchestrator/repository.mjs .github/scripts/agent-orchestrator/handlers.mjs .github/scripts/agent-orchestrator/repository.test.mjs .github/scripts/agent-orchestrator/start.test.mjs .github/scripts/agent-orchestrator/pr-created.test.mjs
git commit -m "feat: Cursor Agentの起動とDraft PR ACKを追加"
```

### Task 4: PR comments、Human Input、CI retry、Human Review gate

**Files:**
- Modify: `.github/scripts/agent-orchestrator/core.mjs`
- Modify: `.github/scripts/agent-orchestrator/handlers.mjs`
- Modify: `.github/scripts/agent-orchestrator/repository.mjs`
- Test: `.github/scripts/agent-orchestrator/comments.test.mjs`
- Test: `.github/scripts/agent-orchestrator/ci.test.mjs`

**Interfaces:**
- Produces: `handleComment(event)`, `handleCi(event)`
- Adds: `getCurrentPullRequest(number)`, `getLatestCiRun(pr, workflowName)`, `listCiRuns(pr, workflowName)`, `listReviews(pr)`, `getHeadCommit(pr)`

- [ ] **Step 1: Write failing comment state tests**

Assert that a new exact Human Input marker on a managed PR moves `In Progress` or `Rework` to `Human Input`; only `yuto90` standalone `@cursor` moves `Human Input`/`Blocked`/`Rework` to `In Progress`; Issue comments, unauthorized users, normal text, stale/terminal sessions do nothing.

- [ ] **Step 2: Write failing CI cycle tests**

Use literal run fixtures to assert current-head latest-run selection, stale SHA ignore, retry comments 1/2/3, fourth failure -> `Blocked`, same run redelivery dedupe, cancelled ignore, success reset boundary, and both event orders for ready marker + CI success.

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test .github/scripts/agent-orchestrator/comments.test.mjs .github/scripts/agent-orchestrator/ci.test.mjs`

Expected: FAIL for missing handlers.

- [ ] **Step 4: Implement comment handler**

Resolve only PR comments (`event.issue.pull_request`), confirm Agent-managed closing Issue, inspect exact marker/author/current status, then perform one allowed transition. On ready comment call the shared Human Review gate using its SHA marker and invalidation timestamp from latest Human Input, accepted resume comment or changes-requested review.

- [ ] **Step 5: Implement CI handler**

Require workflow name `Pull Request CI`, `completed`, open same-repository PR, current head SHA and newest run. Count retry markers after the latest successful CI run. Post a `yuto90` comment with run URL and unique marker for retries 1-3; transition to `Blocked` on the next failure. On success evaluate Human Review gate.

- [ ] **Step 6: Run tests and commit**

Run: `node --test .github/scripts/agent-orchestrator/comments.test.mjs .github/scripts/agent-orchestrator/ci.test.mjs`

Expected: PASS.

```bash
git add .github/scripts/agent-orchestrator/core.mjs .github/scripts/agent-orchestrator/handlers.mjs .github/scripts/agent-orchestrator/repository.mjs .github/scripts/agent-orchestrator/comments.test.mjs .github/scripts/agent-orchestrator/ci.test.mjs
git commit -m "feat: Human InputとCI自動修正を追加"
```

### Task 5: Review、merge/close、cancel handlers

**Files:**
- Modify: `.github/scripts/agent-orchestrator/handlers.mjs`
- Test: `.github/scripts/agent-orchestrator/review.test.mjs`
- Test: `.github/scripts/agent-orchestrator/merge.test.mjs`
- Test: `.github/scripts/agent-orchestrator/cancel.test.mjs`

**Interfaces:**
- Produces: `handleReview(event)`, `handleMerge(event)`, `handleCancel(event)`

- [ ] **Step 1: Write failing review tests**

Assert `Human Review + yuto90 + changes_requested -> Rework`; approved, comment-only, unauthorized reviewer, wrong status, terminal session remain unchanged.

- [ ] **Step 2: Write failing Done tests**

Assert PR closed before Issue close and Issue closed after PR merge both converge to `Done`; require merged, base `main`, verified closing relation and Issue closed. Reject unmerged close, other base, manual Issue close without closing PR, terminal status.

- [ ] **Step 3: Write failing cancel tests**

Assert only a `yuto90` `agent-cancel` label event moves active managed/ready Issue to `Cancelled`; unauthorized label, wrong label, Done/Cancelled do nothing; all other handlers stop mutating after cancel.

- [ ] **Step 4: Run tests and verify RED**

Run: `node --test .github/scripts/agent-orchestrator/review.test.mjs .github/scripts/agent-orchestrator/merge.test.mjs .github/scripts/agent-orchestrator/cancel.test.mjs`

Expected: FAIL for missing handlers.

- [ ] **Step 5: Implement handlers and event-order reconciliation**

Both `pull_request_target.closed` and `issues.closed` must call the same `maybeMarkDone(issue, pr)` routine. Cancel must be fail-closed and every public handler must check terminal status immediately after resolving the Issue.

- [ ] **Step 6: Run all Orchestrator tests and commit**

Run: `node --test .github/scripts/agent-orchestrator/*.test.mjs`

Expected: PASS.

```bash
git add .github/scripts/agent-orchestrator/handlers.mjs .github/scripts/agent-orchestrator/review.test.mjs .github/scripts/agent-orchestrator/merge.test.mjs .github/scripts/agent-orchestrator/cancel.test.mjs
git commit -m "feat: Reviewと完了状態の遷移を追加"
```

### Task 6: CLI、7 GitHub Actions workflows、CI contract job

**Files:**
- Create: `.github/scripts/agent-orchestrator/main.mjs`
- Create: `.github/scripts/agent-orchestrator/workflows.test.mjs`
- Create: `.github/workflows/agent-start.yml`
- Create: `.github/workflows/agent-pr-created.yml`
- Create: `.github/workflows/agent-comments.yml`
- Create: `.github/workflows/agent-ci.yml`
- Create: `.github/workflows/agent-review.yml`
- Create: `.github/workflows/agent-merge.yml`
- Create: `.github/workflows/agent-cancel.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: command argument in `start|pr-created|comments|ci|review|merge|cancel`
- Consumes: `GITHUB_EVENT_PATH`, `GITHUB_TOKEN`, `CURSOR_AGENT_ORCHESTRATOR_PAT`, `GITHUB_STEP_SUMMARY`
- Produces: exit 0 for handled/intentional skip, non-zero for invalid config/API/partial mutation

- [ ] **Step 1: Write failing CLI and workflow contract tests**

Execute `main.mjs` with a temporary event/config and injected fake transport module. Load the existing `app/node_modules/js-yaml` through `createRequire()` and assert exact trigger, static CLI command, `permissions`, trusted checkout ref, `persist-credentials:false`, Node 22, secret mapping, and no `${{ github.event.*body* }}` interpolation in shell.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test .github/scripts/agent-orchestrator/workflows.test.mjs`

Expected: FAIL because CLI/workflows do not exist.

- [ ] **Step 3: Implement CLI with safe summary**

Read JSON from `GITHUB_EVENT_PATH`, map the static command to one handler, write Japanese outcome/reason to `GITHUB_STEP_SUMMARY`, and never print tokens/event bodies. Unknown command or malformed payload must fail with a concise error.

- [ ] **Step 4: Add workflow wrappers**

Use:

```yaml
permissions:
  actions: read
  contents: read
  issues: read
  pull-requests: read

steps:
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.repository.default_branch }}
      persist-credentials: false
  - uses: actions/setup-node@v4
    with:
      node-version: 22
  - run: node .github/scripts/agent-orchestrator/main.mjs start
    env:
      GITHUB_TOKEN: ${{ github.token }}
      CURSOR_AGENT_ORCHESTRATOR_PAT: ${{ secrets.CURSOR_AGENT_ORCHESTRATOR_PAT }}
```

Each workflow uses its static command and session-scoped concurrency with `cancel-in-progress:false`. `agent-pr-created`/PR side of merge use `pull_request_target`; CI uses `workflow_run` without PR checkout.

- [ ] **Step 5: Add Orchestrator contract job to existing CI**

Add a `agent-orchestrator` job to `.github/workflows/ci.yml` that checks out code, sets Node 22, installs `app` dependencies once for YAML parsing, and runs `node --test .github/scripts/agent-orchestrator/*.test.mjs` from repository root.

- [ ] **Step 6: Run tests and commit**

Run: `node --test .github/scripts/agent-orchestrator/*.test.mjs`

Expected: PASS.

```bash
git add .github/scripts/agent-orchestrator/main.mjs .github/scripts/agent-orchestrator/workflows.test.mjs .github/workflows/agent-*.yml .github/workflows/ci.yml
git commit -m "feat: Agent Orchestrator workflowsを追加"
```

### Task 7: Cursor skillsを一つずつ評価・作成

**Files:**
- Create: `.cursor/skills/architecture/SKILL.md`
- Create: `.cursor/skills/implementation/SKILL.md`
- Create: `.cursor/skills/testing/SKILL.md`
- Create: `.cursor/skills/code-review/SKILL.md`
- Create: `.cursor/skills/human-escalation/SKILL.md`
- Create: `.cursor/skills/create-pr/SKILL.md`
- Create: `.cursor/skills/fix-ci/SKILL.md`
- Create: `docs/cursor-skill-evaluations.md`

**Interfaces:**
- Consumes: `AGENTS.md`, `.agent-shared/skills/*`, Issue, current PR, Actions run
- Produces: exact Human Input/ready protocol and `cursor/* -> main` development behavior

- [ ] **Step 1: RED baseline for `architecture`**

Give a fresh agent an ambiguous Volunty feature request without the skill and record whether it reads `AGENTS.md`/design docs, separates repo-pattern decisions from escalation, and avoids inventing requirements. Record observed omissions in `docs/cursor-skill-evaluations.md`.

- [ ] **Step 2: Create and verify `architecture`**

Add frontmatter `name: architecture`, a third-person `Use when...` description, required source order, autonomous decision boundary, Human Input handoff, quick reference and common mistakes. Repeat the same scenario with the skill; record compliance before moving on.

- [ ] **Step 3: RED/GREEN `implementation`**

Baseline scenario pressures the agent to expand scope, edit unrelated files and add `agent-ready` to a follow-up Issue. Skill must require Issue scope, existing patterns, type safety, separate unlabelled follow-up Issue, and no `main` push/merge. Verify before next skill.

- [ ] **Step 4: RED/GREEN `testing`**

Baseline scenario pressures the agent to skip tests near a deadline. Skill must route to `volunty-test-completion-gate`, require change-matched UT/E2E, lint, UT, webpack build and CI evidence. Verify before next skill.

- [ ] **Step 5: RED/GREEN `code-review`**

Baseline scenario offers a clean-looking diff with a hidden authorization regression. Skill must prioritize correctness, security/authz, regressions, types, test gaps and unrelated diffs, then fix evidence-backed findings. Verify before next skill.

- [ ] **Step 6: RED/GREEN `human-escalation`**

Baseline scenario combines a destructive migration, deadline and product ambiguity. Skill must stop dependent work and post exactly `<!-- agent:human-input -->` plus decision, reason, options, Pros/Cons, recommendation and requested answer on the Draft PR. Verify before next skill.

- [ ] **Step 7: RED/GREEN `create-pr`**

Baseline scenario tempts a late non-Draft PR, checkpoint file and auto-merge. Skill must create `cursor/issue-N-slug`, use empty commit when needed, open early Draft PR to `main`, include one `Fixes #N`, avoid Project/labels, run verification, call `gh pr ready`, then post exact ready marker plus current SHA marker, never merge. Verify before next skill.

- [ ] **Step 8: RED/GREEN `fix-ci`**

Baseline scenario tempts a new PR, test skip and stale log fix. Skill must verify current head/run URL, diagnose root cause, preserve tests/types, push the same branch, and keep the same Agent session. Verify before deployment.

- [ ] **Step 9: Validate all skills and commit**

For each skill verify name characters, description `Use when`, frontmatter length, body under 500 words, forward-slash paths, one-level references, quick reference, common mistakes. Actual Cursor behavior remains a required live-smoke gate.

```bash
git add .cursor/skills docs/cursor-skill-evaluations.md
git commit -m "feat: Cursor Cloud Agent skillsを追加"
```

### Task 8: Cursor Cloud運用文書とrepository instructions

**Files:**
- Create: `docs/cursor-cloud.md`
- Modify: `AGENTS.md`
- Modify: `docs/branch-workflow.md`
- Modify: `docs/codex-cloud.md`

**Interfaces:**
- Consumes: final workflow/config/skill names
- Produces: human setup, PAT rotation, Project migration, preflight, start/recovery/cancel/review/rollback runbook

- [ ] **Step 1: Add Cursor-specific rules to `AGENTS.md`**

State that `agent-ready` uses `cursor/*`, same PR session, fixed markers, Project/label mutation prohibition, human-only merge, production secret prohibition, and link `docs/cursor-cloud.md`. Preserve existing Codex Cloud rules.

- [ ] **Step 2: Write `docs/cursor-cloud.md`**

Include current Environment install command, Node 22, branch prefix, no local MCP dependency, seven workflows, Status transition table, two label descriptions/colors, PAT exact minimum permissions/finite expiry, Actions secret name, Project option migration, built-in workflows to disable, manual preflight, normal/Human Input/Blocked/Rework/Cancel operations, incident rollback and token revocation.

- [ ] **Step 3: Update branch and Codex coexistence docs**

Add `cursor/*` to the branch table and autonomous flow; clarify `codex/*` remains manual and neither flow auto-merges. Link both cloud runbooks from each relevant document.

- [ ] **Step 4: Validate docs and commit**

Run: `git diff --check`

Expected: no whitespace errors or placeholder strings.

```bash
git add AGENTS.md docs/cursor-cloud.md docs/codex-cloud.md docs/branch-workflow.md
git commit -m "docs: Cursor Cloud Agent運用手順を追加"
```

### Task 9: Completion gate、full verification、Ready PR

**Files:**
- Modify if findings require: implementation files above

**Interfaces:**
- Produces: verified branch and `main`-base Ready PR; no merge

- [ ] **Step 1: Apply `volunty-test-completion-gate`**

Record why application E2E additions are or are not required. Orchestration paths require Node contract tests and a post-merge live GitHub/Cursor smoke test; no browser UI application code is changed.

- [ ] **Step 2: Run focused and repository verification**

```bash
node --test .github/scripts/agent-orchestrator/*.test.mjs
cd app && npm run lint
cd app && npm test
cd app && npm run build -- --webpack
git diff --check origin/main...HEAD
```

All commands must exit 0. Fix failures through new failing regression tests.

- [ ] **Step 3: Review security and spec coverage**

Compare all 51 specification sections and design decisions against files/tests. Confirm no PR-head checkout in privileged workflows, no untrusted shell interpolation, no PAT in Cursor, all handlers terminal/idempotent, seven workflow names present, all eight Status names exact, and no auto-merge path.

- [ ] **Step 4: Finish branch and create Ready PR**

Use `git-finish-worktree-pr` and `superpowers:finishing-a-development-branch`. Push `codex/cursor-agent-orchestrator`, create `main`-base PR, include test results/security boundary/manual post-merge steps, and run one GitHub Codex review. Do not merge.

- [ ] **Step 5: Verify remote evidence**

Confirm PR head SHA, GitHub Actions `agent-orchestrator`/quality/rls/e2e, Vercel Preview and Codex Review correspond to current SHA. Resolve all actionable findings on the same branch.

### Task 10: Post-merge external configuration and live acceptance

**Files:**
- External: GitHub fine-grained PAT, repository Actions secret, labels, Project `#2`, Cursor Cloud settings, smoke Issue/PR

**Interfaces:**
- Consumes: workflows merged to `main`
- Produces: operational GitHub Projects × Cursor Cloud Agent system

- [ ] **Step 1: Wait for human merge**

Verify the implementation PR is merged to `main` and workflows exist on the default branch. The Agent never merges it.

- [ ] **Step 2: Obtain scoped approval for PAT**

Before Chrome mutation, present resource owner `seikatu-gakari`, repository `volunty`, Issues read/write, organization Projects read/write, finite expiry, secret name and `yuto90` impersonation impact. Create/store only after explicit approval.

- [ ] **Step 3: Configure GitHub through Chrome**

Create labels `agent-ready` (`0E8A16`) and `agent-cancel` (`B60205`), migrate Status options to exact eight values, run manual preflight, then disable the five conflicting built-in Project workflows. Re-read counts/options immediately before mutation and stop on drift.

- [ ] **Step 4: Verify Cursor Cloud through Chrome**

Confirm repository, Environment build, Node/install command, `cursor/` prefix, GitHub integration, PR creation setting and absence of production secrets. Do not replace the working Environment with `.cursor/environment.json`.

- [ ] **Step 5: Obtain approval and run live smoke**

Name the docs-only Issue, Cursor usage/cost, expected Draft PR/change and human merge requirement. After approval, verify dispatch once, Draft ACK/In Progress, Human Input/resume, ready+CI/Human Review, Rework/resume, human merge, Issue close and Done. Use a separate state-only Issue for Cancelled if needed.

- [ ] **Step 6: Audit completion**

Map every completion condition from the 51-section specification to repository tests, workflow run, Project history, Issue/PR comments, CI, Cursor session and human merge evidence. Mark the goal complete only when all required evidence is current and authoritative.
