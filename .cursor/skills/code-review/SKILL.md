---
name: code-review
description: Use when a Volunty change involves authorization, GitHub Actions workflows, production secrets, regressions, runtime types, or test-evidence risk.
---

# Code Review

## Review Contract

Before Ready, read the Issue/AC and full tracked/untracked diff. Author summaries or a green command alone are insufficient evidence.

Review in this exact priority: correctness; security/authz/secret/permission; regressions/compatibility; types/runtime validation; change-matched test gaps; unrelated diff.

Authorization is DB `m_user.role`; completion is its role profile row. Self-editable metadata is never authorization. Missing/invalid data must fail closed, including suspension.

## Pre-Commit GitHub Actions Workflow Gate

Any `.github/workflows/**` diff is high risk. Before a local commit containing it, review the uncommitted workflow diff line by line; never defer to push/Ready. Record `pre-commit`, files, verdict, and six results: trigger; `permissions`; checkout/untrusted code; secret reachability/logging; external Actions/refs; shell interpolation/untrusted contexts.

If production-secret reachability may change, use `human-escalation` to escalate to `yuto90`; stop commit, push, and Ready. `.github/workflows/production-db-migrate.yml` needs separate explicit approval recorded in the Issue or PR before commit; without it, escalate and stop. Green CI, unchanged secret names, and claimed equivalence are not proof.

After push, a human repeats review before merge; agents never merge. This gate controls compliant agents only: bypassed `workflows: write` can run a new `on: push` workflow before human review and reach repository secrets. `CODEOWNERS` and required code-owner review govern merge, not pre-review execution.

Example: a “cleanup” changing `ci.yml` and `production-db-migrate.yml` stays uncommitted until the pre-commit record, separate approval, and required `yuto90` escalation are complete.

## Evidence-Backed Findings

Report only impact-bearing findings, ordered by severity, with tight `file:line`, impact/exploit, evidence, smallest fix, and covering test.

Critical/Important findings block Ready. Fix them in the same session/branch/PR, restore tests, use `testing` and `volunty-test-completion-gate`, then re-review. Product/authority ambiguity requires `human-escalation` and stops dependent work.

Preserve human merge authority. Do not change Projects or labels.

## Quick Reference

| Signal | Review action |
| --- | --- |
| Metadata used for role/completion | Trace DB role/profile checks and add a negative regression test |
| Green after deleted negatives | Treat it as insufficient evidence; restore coverage |
| Workflow changed | Before local commit, record the six checks and verdict |
| Production migration workflow changed | Require recorded separate approval before commit |
| Production-secret impact possible | Escalate to `yuto90`; stop commit, push, and Ready |
| Important finding | Fix and re-review before Ready |
| Scope/authority ambiguity | Escalate; stop dependent work |

## Common Mistakes

- Accepting `as` casts as runtime validation.
- Treating mutable user metadata as authorization.
- Missing removed negative tests because lint/build pass.
- Calling a workflow diff minor because CI is green.
- Creating a local workflow commit first because it has not been pushed.
- Skipping checkout, external Actions, or shell expansion.
- Allowing unapproved production migration or missing `yuto90` escalation.
- Declaring Ready before the corrected diff and covering tests are reviewed.
