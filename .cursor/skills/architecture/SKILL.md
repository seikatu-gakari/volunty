---
name: architecture
description: Use when a Volunty Issue needs architectural decisions before implementation, especially when requirements are ambiguous or existing repository patterns may constrain the design.
---

# Architecture

## 原則

Issue/Acceptance Criteria（AC）を満たす最小設計を、確認済み根拠だけで決める。既存 pattern は実現方法の根拠であり、未記載要件の根拠ではない。

## 確認した根拠（出力必須）

設計方針や Human Input より先に、実際に読んだ根拠を次の順で出力する。各項目に path と採用根拠/不一致を書き、対象がなければ `該当なし` と明記する。

```markdown
## 確認した根拠
1. `AGENTS.md`: [確認事項]
2. 関連 skills: [skill 名と `.agent-shared/skills/<skill-name>/SKILL.md`]
3. Issue/AC: [Issue 番号、AC、確定コメント]
4. docs: [document map から一段の `docs/` design/spec]
5. implementation/tests: [`rg` で確認した実装/test paths]
```

この順で読んでから列挙する。読んでいない資料を記載せず、下位資料で上位制約を上書きしない。矛盾・不足が結果を変えるなら Human Input にする。

## 自律判断の境界

次の3条件を**すべて**満たす判断だけ自律的に確定する。

- Issue/AC の範囲内。
- 既存 pattern から一意に決まる。
- 可逆な技術判断で、下記対象を含まない。

例: 一意な既存 pattern に従う型の再利用、Server/Client 境界、既存ディレクトリへのファイル配置。

次は推測しない: 画面の意味、件数、画面内配置、文言方針、データ永続化、AC 変更、認証・認可/security、破壊的変更、外部コスト、大きな trade-off。たとえば Issue にない「上位3件」「OpportunityCard に置く」「ログ作成前に3件へ絞る」は既存実装から発明しない。

## Human Input handoff

Agent-managed Draft PR に次の形で投稿し、回答に依存する作業を停止する。marker に属性を加えない。

```markdown
<!-- agent:human-input -->

## 判断事項
[決める必要があること]

## 理由
[Issue/AC と確認済み根拠だけでは一意に決まらない理由]

## 選択肢
### A: [案]
- Pros: [利点]
- Cons: [欠点]

### B: [案]
- Pros: [利点]
- Cons: [欠点]

## 推奨案
[案と根拠]

## 求める回答
[回答してほしい項目]
```

## Quick Reference

| 状況 | 行動 |
| --- | --- |
| Issue/AC 内で pattern が一意、かつ可逆 | 根拠を記録して最小設計を確定 |
| pattern が複数、資料が矛盾 | Draft PR で Human Input |
| 意味・件数・配置・文言・永続化を決める必要がある | Draft PR で Human Input |
| 実装都合で scope を広げたくなった | Issue/AC に戻り、追加しない |

## Common Mistakes

- `AGENTS.md` より先にコード検索し、規約を見落とす。
- 既存 component を、件数・配置・文言の承認と解釈する。
- 実装が可逆なら、未承認のプロダクト判断も可能と考える。
- 通常コメントだけで済ませ、exact marker や必要項目を欠かす。
- 回答依存の作業を続ける。
