---
name: volunty-mcp-operations
description: 'Use when: Volunty で MCP 設定、.mcp.json、GitHub MCP 認証情報、GITHUB_MCP_TOKEN の扱いを確認する必要がある。'
argument-hint: '例: MCP設定を変更 / GitHub MCPトークンの扱い / .mcp.jsonをコミットしてよいか確認'
---

# MCP 運用

- `.mcp.json` はローカル生成物であり、`.gitignore` 対象のためコミットしない。
- MCP サーバー定義の正は `.agent-shared/mcp/servers.json` とする。
- `.codex/config.toml` の MCP セクションは直接編集せず、次のコマンドで同期する。
  `node .agent-shared/scripts/sync-agent-mcp.mjs --codex-config .codex/config.toml`
- Codex worktree setup では `.agent-shared/scripts/codex-worktree-setup.sh` が同じ同期を自動実行する。
- GitHub MCP の認証情報は `GITHUB_MCP_TOKEN` 環境変数からのみ注入する。
- tracked file にトークンや認証情報を書かない。

## Codex Cloud

- Codex Cloudでは `mcpc` やネイティブMCPを使用せず、用途ごとのCLIを直接使用する。
- Context7はsetup/maintenanceで公式 `ctx7@0.5.7` CLIを使用する。
  - ライブラリ検索: `ctx7 library <name> '<query>'`
  - ドキュメント取得: `ctx7 docs <library-id> '<query>'`
- ブラウザ/E2Eは `cd app && npx playwright`、DBは `cd app && npx prisma` を使用する。
- UTは `cd app && npx vitest`、lintは `cd app && npx eslint`、型チェックは `cd app && npx tsc` を使用する。
- Serena相当のコード調査は `rg`、`git grep`、TypeScript、既存テストで行う。
- GitHub操作とPR作成はCodex Cloud標準のGitHub接続を使用し、GitHub MCPトークンを登録しない。
- Figma LocalはCloudコンテナから利用できないため使用しない。
- Vercel token、本番シークレット、その他の認証情報をCloudやtracked fileへ登録しない。

## 確認ポイント

- MCP 設定を変更する場合は、差分に秘密情報が含まれていないか確認する。
- `.mcp.json` が意図せず追跡対象になっていないか確認する。
- `.codex/config.toml` の MCP セクションが `.agent-shared/mcp/servers.json` から再生成されているか確認する。
- 認証情報を README、docs、設定ファイル、テストデータへ書かない。
- CloudでContext7を利用する場合は、Agent internet accessを `context7.com` に必要なHTTPメソッドだけ許可する。
