---
name: volunty-dev-commands
description: 'Use when: Volunty の開発・検証コマンド、lint/test/build、Vitest 単体テスト、Docker Compose 操作を実行または案内する必要がある。'
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