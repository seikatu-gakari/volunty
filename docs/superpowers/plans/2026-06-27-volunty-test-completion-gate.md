# Volunty Test Completion Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Volunty の実装完了前に、必要な UT/E2E の追加と実行を Codex が必ず判定するプロジェクト内completion gateを構築する。

**Architecture:** 判断ロジックは新規 `volunty-test-completion-gate` skill に集約する。`AGENTS.md` は入口ルーティング、既存skillsはコマンドとcompletion gateへの参照だけを持ち、静的検証スクリプトで配線を保証する。

**Tech Stack:** Markdown skills、Node.js静的検証、Vitest、Playwright

## Global Constraints

- UTとE2Eの詳細な判定基準は新規skillだけに置く。
- E2Eはユーザーフローに影響する変更へリスクベースで要求する。
- 必要なテストが不足または未実行なら、実装完了を宣言しない。
- `.claude/settings.local.json` を変更しない。
- commit、push、PR作成はこの計画に含めない。

---

### Task 1: Completion gate配線の静的検証

**Files:**
- Create: `scripts/verify-agent-test-completion-gate.mjs`

**Interfaces:**
- Produces: 必須ルールとskill参照が欠けている場合にexit code 1を返す検証コマンド。

- [x] `AGENTS.md`、新skill、3つの既存skillを読み、必須文字列を検証するスクリプトを追加する。
- [x] `node scripts/verify-agent-test-completion-gate.mjs` を実行し、新skill未作成でFAILすることを確認する。

### Task 2: 新規completion gate skill

**Files:**
- Create: `.agent-shared/skills/volunty-test-completion-gate/SKILL.md`
- Create: `.agent-shared/skills/volunty-test-completion-gate/agents/openai.yaml`

**Interfaces:**
- Produces: 実装完了前の変更分類、UT/E2E追加判定、実行証拠、適用外理由の必須フォーマット。

- [x] skill creator の `init_skill.py` でskillを初期化する。
- [x] UT/E2E判定表、完了条件、未実行時の扱い、完了報告フォーマットを実装する。
- [x] `quick_validate.py` でskillを検証する。

### Task 3: 入口ルールと既存skillsの接続

**Files:**
- Modify: `AGENTS.md`
- Modify: `.agent-shared/skills/volunty-dev-commands/SKILL.md`
- Modify: `.agent-shared/skills/volunty-ai-development-guidelines/SKILL.md`
- Modify: `.agent-shared/skills/git-finish-worktree-pr/SKILL.md`

**Interfaces:**
- Consumes: Task 2の `volunty-test-completion-gate`。
- Produces: 実装開始・完了・commit前の各経路からcompletion gateを発見できる入口。

- [x] `AGENTS.md` に共通ルール1行とSkillルーター1行を追加する。
- [x] 開発コマンドskillへ `make e2e`、`make e2e-ui`、`make e2e-report` を追加する。
- [x] AI開発skillとPR完了skillからcompletion gateを必須参照する。
- [x] 静的検証スクリプトを再実行しPASSを確認する。

### Task 4: 最終レビュー

**Files:**
- Verify only

- [x] `git diff --check` を実行する。
- [x] `rg` でUT/E2E判定基準が複数skillへ重複していないことを確認する。
- [x] 既存差分の `.claude/settings.local.json` を今回の変更対象として触っていないことを確認する。
