---
name: volunty-architecture-design
description: 'Use when: Volunty のアーキテクチャ、Server Components 方針、XState 診断フロー、BIG5 スコア計算、デザインカラーを確認する必要がある。'
argument-hint: '例: 診断フローを変更 / Server Component方針を確認 / デザイン色を確認'
---

# アーキテクチャ・設計

## 原則

- Server Components をデフォルトにする。
- ドメインロジックは `app/src/lib/` に集約する。
- 複数ステップのフロー管理には XState を使う。
- TypeScript strict mode を前提に型安全に実装する。

## 診断フロー (XState)

```text
idle → answering → checkProgress → calculating → completed
              ↑          │
              └──────────┘（次の質問へ）
```

- `DiagnosisWizard` が `useMachine` を使う。
- `QuestionCard` / `ResultView` に props を伝播する。
- BIG5 スコアは Likert 1-5 を `(rawScore - 1) / 4 * 100` で 0-100 に正規化する。
- 逆転項目は `6 - value` で処理する。
- タイプ判定は criteria 完全一致（priority 順）を優先し、一致しない場合はユークリッド距離の近似フォールバックを使う。

## デザインカラー

`@theme inline` で Tailwind クラス化されている CSS 変数を使う。

```css
--background: #ffeee2;
--primary: #fb5b01;
--primary-dark: #c74700;
--text-dark: #6d2700;
--text-body: #8b4513;
```

## 関連ファイル

- [app/src/lib/personality/machine.ts](../../../app/src/lib/personality/machine.ts)
- [app/src/lib/personality/logic.ts](../../../app/src/lib/personality/logic.ts)
- [app/src/app/globals.css](../../../app/src/app/globals.css)