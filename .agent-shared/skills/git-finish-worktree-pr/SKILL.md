---
name: git-finish-worktree-pr
description: 'Use when: ユーザーが現在の変更を commit、push、GitHub Pull Request 作成まで進めたいと依頼したとき。例: 今の修正をcommitして / pushしてPR作って / この作業をPR化して / worktreeの変更をPRにして / GitHubにPRを作成して。'
---

# Git Finish Worktree PR

## 起動条件

ユーザーが以下のように依頼したときに使う。

- 「今の修正をcommitして」
- 「pushしてPR作って」
- 「この作業をPR化して」
- 「現在の変更をcommit, push, PRまでやって」
- 「worktreeの変更をPRにして」
- 「GitHubにPRを作成して」

## 基本方針

現在の作業ディレクトリで行われている修正だけを安全に確認し、適切な作業ブランチ上で commit、push、GitHub Pull Request 作成まで進める。作業開始前に方針を短く説明する。

worktree で作業している場合、別 worktree やメイン作業ツリーで commit しない。`main` / `master` や detached HEAD では絶対に commit しない。

## 事前安全確認

commit 前に必ず以下を実行する。

```bash
git rev-parse --show-toplevel
git status --short --branch
git branch --show-current
git rev-parse --abbrev-ref HEAD
git worktree list
git remote -v
```

確認ルール:

- 現在位置が Git リポジトリ内であることを確認する。
- `git status --short --branch` で現在のブランチと差分を確認する。
- 現在のブランチが `main` または `master` なら commit / push / PR 作成を中止する。
- `git rev-parse --abbrev-ref HEAD` が `HEAD` なら detached HEAD と判断し、中止する。
- `git worktree list` に `git rev-parse --show-toplevel` のパスが含まれることを確認する。
- ユーザーが worktree 作業を意図している場合、現在の作業ディレクトリがその worktree root 配下であることを確認する。
- 変更差分が空なら中止する。
- secret、API key、`.env`、認証情報、不要な生成物、巨大ファイルが混入していないか確認する。
- 既存ブランチ名が作業内容に対して不適切な場合、勝手に `main` へ戻らず、現在の作業ブランチ上でブランチ名変更など安全な対応を提案する。

安全上の問題がある場合は、ユーザーが「確認なしで進めて」と明示していても中止する。

## 差分確認

commit 前に以下を実行し、変更内容を把握する。

```bash
git diff --stat
git diff
git status --short
```

必要に応じて staged 差分も確認する。

```bash
git diff --cached
```

確認ルール:

- 変更内容を要約する。
- 意図しないファイルが含まれていないか確認する。
- テストや lint が必要そうな変更であれば、リポジトリの慣習に従って実行する。
- `package.json`、lockfile、`prisma/schema.prisma`、migration、CI 設定が変更されている場合は特に注意する。
- 無関係な差分がある場合は勝手にまとめず、commit 対象から外すかユーザーへ確認する。

## テスト・検証

リポジトリ構成を見て、実行可能な範囲で検証する。package manager は lockfile に合わせる。

実装・修正・リファクタリングを含む場合は、commit 前に `volunty-test-completion-gate` を使い、必要な UT/E2E の追加と実行結果を確認する。適用外と判断した区分は、その理由を完了報告へ残す。

優先順位:

1. `pnpm-lock.yaml` があれば `pnpm`
2. `yarn.lock` があれば `yarn`
3. `bun.lockb` または `bun.lock` があれば `bun`
4. `package-lock.json` があれば `npm`
5. 判断できない場合は `package.json` の scripts と既存ドキュメントを確認する

検証コマンドの例:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

検証に失敗した場合:

- 失敗内容を要約する。
- 修正可能なら修正し、再検証する。
- 修正できない場合は、失敗した状態で commit / push / PR を進めてよいかユーザーに確認する。
- secret 混入、`main` / `master` commit、detached HEAD commit など安全上の問題は確認を取っても進めない。

## Commit

commit 直前に必ず再確認する。

```bash
git status --short --branch
git branch --show-current
```

`main` / `master` でないこと、detached HEAD でないこと、commit 対象が意図したファイルだけであることを確認する。

commit message は Conventional Commits を基本にする。

例:

- `feat: add organization LINE ID requirement`
- `fix: handle participant profile registration error`
- `docs: update Codex worktree workflow`
- `chore: add git finish PR skill`

判断できない場合は差分内容から適切な message を作る。

commit の流れ:

```bash
git add <必要なファイル>
git status --short
git commit -m "<commit message>"
```

注意:

- 無関係なファイルをまとめて commit しない。
- ユーザーの作業中ファイルや意図しない差分を勝手に含めない。
- `.env` や秘密情報は絶対に commit しない。

## Push

push 前に確認する。

```bash
git branch --show-current
git remote -v
```

push は現在の作業ブランチに対して行う。

```bash
git push -u origin <current-branch>
```

すでに upstream がある場合は通常の push でもよい。

```bash
git push
```

push が失敗した場合:

- エラー内容を要約する。
- 認証エラー、権限エラー、remote 不一致、non-fast-forward などに分類する。
- force push は原則しない。
- force push が必要な場合は必ずユーザー確認を求める。
- どうしても必要な場合でも `--force-with-lease` のみを検討する。

## Pull Request 作成

PR 作成前に base branch を確認する。通常は `main`。default branch が異なる場合はそれに従う。

```bash
gh repo view --json defaultBranchRef
```

GitHub CLI が使える場合は PR を作成する。

```bash
gh pr create
```

必要に応じて以下の形式を使う。

```bash
gh pr create \
  --base <default-branch> \
  --head <current-branch> \
  --title "<PR title>" \
  --body "<PR body>"
```

PR 本文には以下を含める。

```markdown
## Summary

- 変更内容の要約

## Verification

- 実行した確認コマンド: 成功 / 失敗
- 未実行の確認があれば理由

## Notes

- レビュー時に注意してほしい点
- 既知の未対応事項
```

## 完了報告

最後にユーザーへ以下を報告する。

- 現在の作業ディレクトリ
- 現在のブランチ
- commit hash
- push 先ブランチ
- PR URL
- 実行した検証
- 失敗または未実行の検証があればその理由

## 絶対にやってはいけないこと

- `main` / `master` ブランチで commit すること
- detached HEAD で commit すること
- secret や `.env` を commit すること
- ユーザーの確認なしに force push すること
- 意図しない大量ファイルをまとめて commit すること
- 作業ディレクトリを勝手に `main` へ checkout してから作業すること
- worktree で作業しているのに別の worktree やメイン作業ツリーで commit すること
- PR 作成前に差分確認を省略すること

## 使い方

ユーザーは以下のように依頼できる。

- 「今の修正をcommitしてpushしてPR作って」
- 「このworktreeの変更をPR化して」
