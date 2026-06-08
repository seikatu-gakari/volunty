---
name: volunty-rtk-cli
description: 'Use when: Volunty ローカルで lint/test/build/git/docker などのシェルコマンド出力を rtk プレフィックスで削減したい、または RTK の使い方を確認する必要がある。'
argument-hint: '例: 出力を減らしてテスト実行 / rtkの使い方 / lint結果を短く見たい'
---

# RTK — トークン最適化 CLI

シェルコマンドに `rtk` プレフィックスを付けることで出力を 60-90% 削減できる。

## プロジェクトルート

```bash
rtk git status
rtk git diff
rtk "git log -n 10"
rtk docker compose ps
```

## app/ ディレクトリ

```bash
cd app && rtk npm run lint
cd app && rtk npm run test
cd app && rtk next build
cd app && rtk tsc --noEmit
cd app && rtk prisma generate
```

## メタコマンド

```bash
rtk gain
rtk gain --history
rtk discover
```

## 注意

- `curl` は除外済み。完全レスポンスが必要なため RTK を使わない。
- CI 非対応。ローカル専用。
- バイパスする場合は `RTK_DISABLED=1 <cmd>` を使う。