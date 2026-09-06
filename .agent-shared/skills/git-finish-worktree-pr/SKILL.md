---
name: git-finish-worktree-pr
description: "Voluntyの変更をcommit・push・PR作成する依頼で使う。依頼された到達点まで進める。"
---

# Commit・Push・PR

依頼がcommitのみならそこで完了する。pushやPRまで依頼された場合はその到達点まで進める。設計・調査のみの依頼を実装や公開の承認と解釈しない。

## 対象を確定する

現在のrepository、worktree、branch、remote、staged/unstaged差分、baseからのcommit差分を確認する。対象ファイルだけを扱い、ユーザーの無関係な変更と秘密情報を含めない。

- 新規Codexブランチは `codex/<topic>`。既存の適切な `feature/*` は継続可能。PRのbaseは `main`。運用詳細は [ブランチ運用](../../../docs/branch-workflow.md)。
- `main` / `master` / detached HEADにいる場合は、その状態へcommitせず、変更を保った作業ブランチを作成する。分離が必要ならworktreeを使う。安全に分離できない場合だけ確認する。
- 未コミット差分がなくてもbaseとの差分があれば、既存commitのpush・PR作成を続行できる。既存PRがあれば再利用する。
- 同じファイルにユーザーの変更が混在し、対象部分を確実に分離できない場合は確認する。stash・破棄・一括stageで解決しない。

## 検証とcommit

コード変更の検証は [volunty-test-completion-gate](../volunty-test-completion-gate/SKILL.md) に従う。文章・指示のみなら内容・参照・構文を確認する。すでにある有効な検証結果は利用し、依頼に起因する失敗は修正して影響範囲を再検証する。

対象パスを明示してstageし、staged差分を確認してConventional Commitsでcommitする。説明は日本語。`main` / `master` / detached HEADへのcommit、秘密情報のcommitは禁止。

## PushとPR（依頼された場合）

- 作業ブランチへ通常pushする。失敗時は原因とリモートの実状態を確認し、安全な範囲で解消する。force pushは別途承認が必要で、使用する場合も `--force-with-lease` のみ。
- PRには変更による振る舞い、検証結果、未確認事項を記す。複数行の本文はファイルへ書き、`gh pr create --base main --head <branch> --body-file <file>` を使う。
- 自動検証は `## Verification` に記載する。手動確認が必要なら `## Manual verification` に操作と期待結果を日本語で記載する。
- PR作成後にURL、base/head、最新HEADのCI・Vercel Preview・Codex Reviewを確認する。レビュー依頼や第三者への通知は、依頼で許可された場合に限る。`deliver-approved-issue` を使用中なら、その1回限りのレビュー契約と通知条件に従う。
- 変更に起因するCI・レビュー・Previewの失敗は同じブランチで修正し、影響する検証を再実行する。追加権限・本番操作・設計拡張が必要な場合は、完了した部分と必要な判断を報告する。

PR作成済みと全ゲート成功を区別し、待機中や未確認を「PR完成」と扱わない。`main` への直接push・マージは行わない。

最後に依頼された到達点、commit SHA、push先・PR URL（該当する場合）、検証結果と残タスクを簡潔に報告する。
