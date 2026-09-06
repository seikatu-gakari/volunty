---
name: volunty-document-map
description: "Voluntyの関連設計書・仕様書・用語表の参照先を探すときに使う。"
argument-hint: '例: 設計書を探す / DB設計を確認 / MVP計画を確認 / 用語表を確認'
---

# ドキュメントマップ

| ファイル | 内容 |
| --- | --- |
| [AGENTS.md](../../../AGENTS.md) | 全 AI エージェント共通の最小入口 |
| [CLAUDE.md](../../../CLAUDE.md) | `@AGENTS.md` を import する Claude Code 用入口 |
| [docs/architecture/](../../../docs/architecture/) | システム・基本設計書 |
| [docs/design/personality-matching-redesign.md](../../../docs/design/personality-matching-redesign.md) | 性格診断・マッチング基盤の現行設計（尺度・ライセンス・DB・評価計画） |
| [docs/design/personality-diagnosis-big5.md](../../../docs/design/personality-diagnosis-big5.md) | 旧 BIG5 診断設計（廃止・参照のみ） |
| [docs/design/database-design.md](../../../docs/design/database-design.md) | DB 設計書 |
| [docs/requirements/mvp-plan.md](../../../docs/requirements/mvp-plan.md) | MVP 計画・機能・画面一覧 |
| [docs/reference/translation-table.md](../../../docs/reference/translation-table.md) | 用語対訳表 |
| [docs/quality/status.md](../../../docs/quality/status.md) | ドメイン別品質グレーディング |
| [specs/features.json](../../../specs/features.json) | MVP フィーチャーリスト（pass/fail 付き） |

## 参照方針

- 新機能実装前に関連する `docs/` の設計書を確認する。
- 設計書と実装が食い違う場合は、コードベースの現状と設計書の差分を明示する。
