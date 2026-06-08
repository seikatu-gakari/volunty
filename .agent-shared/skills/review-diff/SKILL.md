---
name: review-diff
description: Review current git diff, summarize changes, identify risks, and suggest tests before commit.
---

# Review Diff

## Goal
Review the current uncommitted changes before commit.

## Steps
1. Run `git status`
2. Run `git diff`
3. Summarize changed files
4. Identify bugs, regressions, security risks, and type-safety issues
5. Suggest tests or checks to run
6. Provide a concise final review summary
