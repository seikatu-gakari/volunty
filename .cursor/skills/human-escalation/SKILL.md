---
name: human-escalation
description: Use when a Volunty agent must pause dependent work for an unresolved destructive, production, security, authority, cost, or product decision.
---

# Human Escalation

## Escalation boundary

人間の判断なしに次を選ばない: 不可逆な削除・migration、production mutation、security、認証・認可、secret、権限、外部コスト、retention、product semantics、または大きな trade-off。期限、operator の圧力、早く Ready にしたいという要求だけでは escalation の根拠にならない。

依存する実装、migration、delete、production mutation、Ready 化を直ちに停止する。選択肢を決めない read-only 調査、preflight、可逆な準備だけは続けてよいが、出力に「停止中」と「継続中」を分けて記録する。Project、label、merge、別 PR/session/branch は変更しない。

## Draft PR handoff

同じ Agent session、branch、Agent-managed Draft PR に、次の marker を属性なし・1行で1回だけ投稿する。既存の current marker があれば重複投稿しない。

```markdown
<!-- agent:human-input -->

## 判断事項
[具体的に一つの判断。対象データ、範囲、期限ではなく決定内容を示す]

## 理由
[Issue/AC と確認済み根拠、data/preflight、影響・リスク、rollback/retention の不足]

## 選択肢
### A: [案]
- Pros: [利点]
- Cons: [欠点]

### B: [案]
- Pros: [利点]
- Cons: [欠点]

## 推奨案
[案と根拠。未承認の仕様を確定しない]

## 求める回答
[A/B または具体的な値、対象、rollback/retention を回答してほしい]
```

質問は回答可能な具体的判断にする。曖昧な「どうしますか」や、risk・preflight・rollback を欠く選択肢は出さない。回答依存の作業は停止したままにする。Issue/PR/AC に authoritative な回答が記録され、必要項目をすべて満たした後だけ、同じ session と PR で再開する。不足・未記録・権限不明なら停止を維持する。

## Quick Reference

| 状況 | 行動 |
| --- | --- |
| 重大な不可逆・権限・仕様判断 | Draft PR に exact marker と A/B を投稿し、依存作業を停止 |
| 圧力だけで根拠がない | escalation の根拠にせず、Issue/AC と事実を確認 |
| 回答待ち | read-only/reversible prep のみ継続し、停止中/継続中を記録 |
| authoritative な回答が記録済み | 同じ session/PR で内容を再確認して再開 |

## Common Mistakes

- deadline や operator の肩書きを承認として扱う。
- marker に属性を足す、複数投稿する、既存 current marker を重複させる。
- A/B の Pros/Cons、対象 data、preflight、risk、rollback/retention を省く。
- 回答前に migration、削除、production mutation、Ready 化を進める。
- 回答を Issue/PR/AC に記録せず、別 session/PR を作る。
