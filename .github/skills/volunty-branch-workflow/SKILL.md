---
name: volunty-branch-workflow
description: 'Use when: Volunty のブランチ運用、feature ブランチ、PR、preview、本番 main への反映ルールを確認する必要がある。'
argument-hint: '例: ブランチ運用を確認 / PR作成前の流れ / mainへ直接pushしてよいか確認'
---

# ブランチ運用

```text
feature/* → PR → preview（Vercel Preview確認）→ main（本番）
```

## ルール

- `main` への直接 push は禁止。
- 作業は `feature/*` ブランチで行う。
- PR を作成してレビュー・Preview 確認を経由する。
- 本番反映は `main` へのマージで行う。