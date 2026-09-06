---
name: volunty-dev-commands
description: "Voluntyの開発・検証・Docker操作コマンドを確認するときに使う。"
argument-hint: '例: テストを実行 / lintを実行 / Dockerを起動 / build確認'
---

# 開発コマンド

## アプリケーション

```bash
cd app && npm run dev
cd app && npm run build
cd app && npm run lint
cd app && npm run lint:fix
cd app && npm run test
```

## 単体テスト

```bash
cd app && npx vitest run <file>
```

## E2E

```bash
make e2e
make e2e-ui
make e2e-report
```

- 通常の自動実行には `make e2e` を使う。
- 対話デバッグには `make e2e-ui`、直近結果の確認には `make e2e-report` を使う。
- 実行前提と対象ケースは `specs/e2e-playwright-smoke.md` を確認する。

## Docker 操作

```bash
make up
make down
make restart
make logs
make shell
make clean
```

## 注意

- コマンドはプロジェクトルートまたは `app/` のどちらで実行すべきかを確認してから実行する。
- 出力が大きい検証には [volunty-rtk-cli](../volunty-rtk-cli/SKILL.md) の利用を検討する。
