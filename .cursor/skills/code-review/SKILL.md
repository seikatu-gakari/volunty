---
name: code-review
description: Use when a Volunty agent reviews an Issue implementation or amended PR before declaring it Ready, especially for authorization, regression, or test-evidence risk.
---

# Code Review

## Review Contract

Before Ready, read the Issue/AC and the full tracked and untracked diff. Do not trust the author summary or a green command alone.

Review in this exact priority: correctness; security/authz/secret/permission; regressions/compatibility; types/runtime validation; change-matched test gaps; unrelated diff.

Volunty authorization is the authoritative DB `m_user.role`; completion is the corresponding role profile row. Self-editable metadata is never authorization. Check that missing/invalid DB data fails closed and that suspension checks remain effective.

## Evidence-Backed Findings

Report only evidence-backed findings, ordered by severity. Each finding gives a tight `file:line`, impact or exploit, evidence, and the smallest fix with its covering test. Do not report style nits unless they have impact.

Critical or Important findings block Ready. On the same Agent session, branch, and PR, fix every evidence-backed finding; restore or add regression tests; use the `testing` skill and `volunty-test-completion-gate`; then re-review the amended diff. Do not suppress a test/change spec or expand unrelated scope. If the fix depends on product or authority ambiguity, use `human-escalation` and stop dependent work.

Preserve human merge authority. Do not change Projects or labels.

## Quick Reference

| Signal | Review action |
| --- | --- |
| Metadata used for role/completion | Trace DB role/profile checks and add a negative regression test |
| Green after deleted negatives | Treat it as insufficient evidence; restore coverage |
| Important finding | Fix and re-review before Ready |
| Scope/authority ambiguity | Escalate; stop dependent work |

## Common Mistakes

- Accepting `as` casts as runtime validation.
- Treating mutable user metadata as authorization.
- Missing removed suspension or negative tests because lint/build pass.
- Leaving unrelated documentation or terminology edits in the PR.
- Declaring Ready before the corrected diff and covering tests are reviewed.
