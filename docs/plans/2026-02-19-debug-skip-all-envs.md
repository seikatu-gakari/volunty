# デバッグスキップ全環境表示 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** デバッグ用スキップボタンを環境チェックなしで常時表示する。

**Architecture:** `DiagnosisWizard.tsx` の `onSkip` prop に渡す条件式を削除し、`handleDebugFill` を常に渡す。`QuestionCard` 側はすでに `onSkip` を受け取れる実装済みのため変更不要。

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / Tailwind CSS 4

---

### Task 1: 環境チェック条件の削除

**Files:**
- Modify: `app/src/app/diagnosis/components/DiagnosisWizard.tsx:55`

**Step 1: 現在の状態を確認**

```bash
grep -n "onSkip" app/src/app/diagnosis/components/DiagnosisWizard.tsx
```

Expected output:
```
55:          onSkip={process.env.NODE_ENV === 'development' ? handleDebugFill : undefined}
```

**Step 2: 条件式を削除して常時 handleDebugFill を渡す**

`DiagnosisWizard.tsx` の55行目を変更：

```tsx
// 変更前
onSkip={process.env.NODE_ENV === 'development' ? handleDebugFill : undefined}

// 変更後
onSkip={handleDebugFill}
```

**Step 3: 変更を確認**

```bash
grep -n "onSkip" app/src/app/diagnosis/components/DiagnosisWizard.tsx
```

Expected output:
```
55:          onSkip={handleDebugFill}
```

**Step 4: コミット**

```bash
git add app/src/app/diagnosis/components/DiagnosisWizard.tsx
git commit -m "debug: デバッグスキップボタンを全環境で表示"
```

**Step 5: プッシュ**

```bash
git push -u origin claude/add-skip-feature-mobile-zZyey
```
