# デバッグスキップボタン全環境表示 — 設計書

**日付:** 2026-02-19
**ブランチ:** claude/add-skip-feature-mobile-zZyey

## 背景

デバッグ用の「残りをランダム回答」ボタンは現在 `NODE_ENV === 'development'` の場合のみ表示される。一時的にステージング・本番を含む全環境で表示したい。

## 設計

### 変更対象

`app/src/app/diagnosis/components/DiagnosisWizard.tsx` の1行のみ。

### 変更内容

```tsx
// 変更前
onSkip={process.env.NODE_ENV === 'development' ? handleDebugFill : undefined}

// 変更後
onSkip={handleDebugFill}
```

### 影響範囲

- `QuestionCard` の `onSkip` prop は既にオプショナル（`onSkip?: () => void`）のため、受け側の変更不要
- ボタンは `QuestionCard` フッター右側に表示済み（前の変更で実装済み）
- 全環境で `[Debug] 残りをランダム回答` ボタンが表示される

### 復元方法

後で開発環境限定に戻す場合は元の条件式に戻す。
