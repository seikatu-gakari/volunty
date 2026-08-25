---
name: testing
description: Use when a Volunty agent must decide, run, and report the tests and CI evidence required before an Issue implementation can be completed or made Ready.
---

# Testing

まず `volunty-test-completion-gate` を読み、その変更分類と完了報告表を使う。Cursor Cloud ではこの skill 内の RED/GREEN 手順を使い、利用不能な外部 sub-skill を必須にしない。

## 変更に対応する検証

branch base を確定し、`git diff --name-only <base>...HEAD`、`git diff --cached --name-only`、`git diff --name-only`、`git ls-files --others --exclude-standard` で全 inventory を得る。Issue と Acceptance Criteria に照らして各変更を分類し、振る舞いごとに gate の UT/E2E を `必須` または `適用外` として理由を残す。既存テストが変更後の振る舞いを assert しているか確認する。

認可、role/profile 判定、Server Action、応募可否の UI、拒否メッセージ、ユーザーフローは、該当する change-matched UT と E2E を必須にする。期限、小さい差分、以前の green、無関係な既存テストは skip 理由にならない。

対象テストを実装より先に追加し、期待した理由で RED になることを確認する。最小実装後に GREEN を確認する。詳細コマンドは `volunty-dev-commands` を参照し、少なくとも対象 UT、全 UT、lint、型チェック、`cd app && npm run build -- --webpack` を実行する。E2E が必須なら `make e2e` も実行し、起動不能なら理由と残タスクを報告して完了にしない。

## CI と完了判定

current PR head SHA と current CI run URL を取得し、run の `headSha` が current head と一致すること、required jobs がすべて success であることを確認する。古い SHA の run、stale run、未実行、失敗は証拠にならない。この場合は完了や Ready を宣言せず、残タスクにする。

最終回答の末尾に次の単一表を各rowすべて埋めて必ず出力する。散在する prose で代替しない。実行禁止なら tests/local commands の結果は `未実行`、CI は `取得不能/未照合` と正直に記す。

| 証拠 | 記録する内容 |
| --- | --- |
| UT/E2E 判定 | 必須または適用外理由 |
| tests | change-matched test path と結果 |
| RED/GREEN | 各確認結果 |
| local commands | 実行コマンドと結果 |
| CI | current run URL、PR head SHA、run headSha、required jobs |

## Quick Reference

| 状況 | 行動 |
| --- | --- |
| 振る舞い変更 | gateでUT/E2Eを分類し、change-matched testをRED/GREENで確認 |
| E2E が必須 | `make e2e` を実行、不能なら残タスク |
| CI が古い/失敗/未実行 | Readyにせず current head のCIを待つ |

## Common Mistakes

- 既存 green CI や全 UT の成功を変更後の検証として流用する。
- 認可と UI の変更を対象 UT 一本だけで完了にする。
- lint、型チェック、webpack build、必要な E2E を期限で省略する。
- CI URL、head SHA、required jobs を照合せず Ready を宣言する。
