---
name: create-pr
description: Use when a Volunty agent creates or continues an Agent-managed Pull Request for an approved Issue before human review.
---

# Create PR

## PR continuity

同じ repository の対象 Issue で Agent-managed open PR を検索する。0件なら新規、1件なら同じ session/branch/PR を再利用する。2件以上なら `human-escalation` にして停止し、どれも選ばない。

新規なら `main` から branch を正確に `cursor/issue-N-slug` として作る。無変更なら state file を作らず `git commit --allow-empty` を使う。Agent progress/checkpoint/resume state の repository 作成・commit は禁止し、状態は GitHub Issue/PR/comments/checks/Git history に記録する。

push 後、直ちに Draft PR を `main` 向けに作る。本文は closing reference を一つだけ含む `Fixes #N` とし、ほかの closing Issue reference を加えない。同じ session/branch/PR を継続する。

```bash
git switch -c cursor/issue-N-slug origin/main
git commit --allow-empty -m "chore: start Issue #N"
git push -u origin cursor/issue-N-slug
gh pr create --draft --base main --head cursor/issue-N-slug --body "Fixes #N"
```

GitHub Projects、Project Status、`agent-ready`、`agent-cancel` を変更しない。merge、auto-merge、`main` push はしない。Orchestrator ACK と人間 merge を維持する。

## Ready protocol

同じ session/branch/PR で Issue implementation、`testing` と `volunty-test-completion-gate`、`code-review` を完了し、同じ branch に push する。未push の変更がなく、local `HEAD`、remote branch head、open PR の `headRefOid` が同じ full SHA、PR が open/same repository/Draft、base が `main`、本文の closing Issue が一つだけと確認して `gh pr ready` を実行する。

Ready 化後も local `HEAD`、remote branch head、open PR の `headRefOid` を再取得し、同じ full SHA と確認してから、次の**二行だけ**を一回の PR comment として投稿する。属性、説明、別 marker を加えない。

```text
<!-- agent:ready-for-review -->
<!-- agent:ready-for-review:v1 head_sha=<current full SHA> -->
```

head が変われば以前の marker は stale である。PR は Ready のまま、再実装・再検証・push・SHA 照合を行い、新しい current SHA の二行 marker だけを投稿する。

## Quick Reference

| 状況 | 行動 |
| --- | --- |
| open PR 0/1/2件以上 | 新規作成/再利用/停止して Human Input |
| 変更がまだない | empty commit で早期 Draft PR |
| verification 未完了 | Draft のまま。Ready marker を投稿しない |
| head が変化 | 再検証後、新 SHA の marker を投稿 |

## Common Mistakes

- checkpoint や Agent progress file を commit して PR 作成の条件を満たす。
- late non-Draft PR、第二の `Fixes`、replacement PR を作る。
- local/remote/PR SHA を照合せず marker を投稿する。
- marker に属性や説明を足す、SHA 変更後に古い marker を流用する。
- Project/labels を操作する、auto-merge/merge/main push をする。
