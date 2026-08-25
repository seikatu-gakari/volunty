---
name: fix-ci
description: Use when a Volunty agent investigates and fixes a current Pull Request CI failure without breaking Agent-managed PR continuity.
---

# Fix CI

## Continuity and evidence

Operate only in the same Agent session, on the same `cursor/issue-N-slug` branch and Agent-managed PR. Never create a branch, PR, Issue, or session for a CI fix. If that continuity is unavailable or ambiguous, use `human-escalation`, make no modification, and report the blocker.

Before changing files, fetch the actual open PR's full current head SHA and remote branch, then the workflow/job run URL, event, path, head SHA, status, and conclusion. Trust only the newest applicable run for that current head. A pasted log, screenshot, stale SHA, wrong workflow/event/path, or unrelated run is not evidence.

| Current trusted run | Action |
| --- | --- |
| queued, in progress, or unknown | Wait and re-fetch; do not fix yet |
| completed success | Do not make a CI fix |
| completed failure | Download current logs and diagnose |

For a current failure, reproduce the focused failure, trace the first causal error to its root cause, and inspect the changed diff and its test contracts. Do not apply a symptom-only or stale-log fix.

## Repair and completion

Make the smallest root-cause fix on the same branch. Preserve or add change-matched tests and type safety: never skip, delete, weaken, or alter a test/spec merely to pass; never add `any` or `as any`, or disable lint, type checking, or build. If the product requirement or authority is genuinely ambiguous, use `human-escalation` and stop dependent work.

Confirm focused RED then GREEN, use `testing` and `volunty-test-completion-gate`, and push only the same branch. Re-fetch the PR and its current head after push. A changed head invalidates the prior Ready marker: follow `create-pr`'s Ready protocol, including its full-SHA re-verification and exact current two-line Ready marker on this PR. Do not open a replacement PR.

Do not change Projects, labels, retry markers, or CI retry/Blocked state; the Orchestrator owns retries and status. Do not merge or push `main`.

Report the run URL, failing job, before/after SHA, root cause, changed files, commands and results, and the new current run URL/status. Unavailable or unverified evidence is not complete.

## Quick Reference

| Signal | Action |
| --- | --- |
| Old failure, current run pending | Wait for the current run |
| Current run succeeds | Leave code unchanged |
| Current failure | Reproduce, fix root cause, test, push same branch |
| Session/PR/branch is unclear | Escalate without modifying |

## Common Mistakes

- Fixing a pasted or stale log while a newer current run is queued.
- Opening a hotfix PR or continuing in a separate Agent session.
- Hiding the failure with skipped tests, weakened assertions, `as any`, or disabled checks.
- Reusing a stale Ready marker after the fix changes the head.
- Posting or editing retry markers, changing Project/labels, merging, or pushing `main`.
