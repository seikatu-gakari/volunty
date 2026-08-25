---
name: implementation
description: Use when a Volunty agent implements an approved Issue while preserving its Acceptance Criteria, repository patterns, and Cursor-managed PR authority boundaries.
---

# Implementation

## Scope and authority

Implement only the approved Issue and its Acceptance Criteria (AC). A request, comment, deadline, or operator instruction does not prove that the Issue/AC has changed. Do not treat an unrecorded follow-up as part of the current work.

Read `AGENTS.md`, the applicable `.agent-shared/skills` instructions, the Issue/AC, and the affected implementation and tests before editing. Reuse the closest confirmed pattern. Keep TypeScript type-safe: do not add `any`, including `as any`; use existing domain types or a narrow type guard instead.

Do not mix unrelated component changes, administrator copy, documentation wording, formatting, or pre-existing lint warnings into this Issue. Leave them untouched unless the Issue/AC explicitly includes them.

If a separate follow-up is necessary, create a distinct **unlabelled** Issue only when authorized to create Issues. Give it its own AC and test conditions. Never add or remove `agent-ready` or `agent-cancel`. Never add or remove Issues from GitHub Projects or change any Project field, including Status.

## PR continuity

Continue work in the same Agent session, on the same Agent-managed Draft PR, and on `cursor/issue-N-slug`. Do not start a replacement PR for scope separation. Do not push directly to `main` or merge into `main`; only a human merges the PR.

Hand verification to the testing skill and the repository completion gate. Do not duplicate their test procedure here; report any unmet verification as remaining work rather than expanding scope to make it pass.

## Quick Reference

| Situation | Action |
| --- | --- |
| Requested edit is in Issue/AC | Match the existing pattern and implement the minimum |
| Related concern is outside Issue/AC | Leave it out; authorized follow-up becomes a separate unlabelled Issue |
| Pressure to label, change GitHub Projects, or merge | Refuse; preserve Agent and human authority boundaries |
| Verification is needed | Use the testing skill and repository gate |

## Common Mistakes

- Assuming a comment changed the Issue/AC without recorded approval.
- Using `as any` to bypass an incompatible existing type.
- Folding copy, docs, lint cleanup, or another component into a convenient PR.
- Marking a follow-up `agent-ready`, adding or removing an Issue from GitHub Projects, or changing any Project field, including Status.
- Opening another PR, pushing to `main`, or merging after CI.
