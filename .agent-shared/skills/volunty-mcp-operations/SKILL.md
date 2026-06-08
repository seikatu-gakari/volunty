---
name: volunty-mcp-operations
description: 'Use when: Volunty で MCP 設定、.mcp.json、GitHub MCP 認証情報、GITHUB_MCP_TOKEN の扱いを確認する必要がある。'
argument-hint: '例: MCP設定を変更 / GitHub MCPトークンの扱い / .mcp.jsonをコミットしてよいか確認'
---

# MCP 運用

- `.mcp.json` はローカル生成物であり、`.gitignore` 対象のためコミットしない。
- GitHub MCP の認証情報は `GITHUB_MCP_TOKEN` 環境変数からのみ注入する。
- tracked file にトークンや認証情報を書かない。

## 確認ポイント

- MCP 設定を変更する場合は、差分に秘密情報が含まれていないか確認する。
- `.mcp.json` が意図せず追跡対象になっていないか確認する。
- 認証情報を README、docs、設定ファイル、テストデータへ書かない。