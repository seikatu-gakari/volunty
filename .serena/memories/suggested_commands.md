# 推奨コマンド集

## フェーズ0：計画雛形作成・調査

### 1. フィーチャーブランチ作成
```bash
git checkout -b 001-your-feature
```

### 2. 環境チェック
```bash
.specify/scripts/bash/check-prerequisites.sh --json
```
- `FEATURE_DIR`と`AVAILABLE_DOCS`表示で準備完了確認

### 3. 計画用ファイル生成
```bash
.specify/scripts/bash/setup-plan.sh --json
```
- `FEATURE_SPEC`, `IMPL_PLAN`, `SPECS_DIR`の値を控える

### 4. 新フィーチャー作成（オプション）
```bash
.specify/scripts/bash/create-new-feature.sh
```

## フェーズ1：設計・Copilot連携

### 1. Copilotコンテキスト更新
```bash
.specify/scripts/bash/update-agent-context.sh copilot
```
- `.github/copilot-instructions.md`を自動更新

### 2. タスク生成
```bash
.specify/scripts/bash/run-command.sh speckit.tasks
```
- `specs/<feature>/tasks.md`を生成・更新

## システム基本コマンド（macOS）

### ファイル操作
```bash
ls -la                    # ディレクトリ内容表示
find . -name "*.md"       # Markdownファイル検索
grep -r "pattern" .       # パターン検索
```

### Git操作
```bash
git status               # 状態確認
git add .               # 全変更をステージング
git commit -m "message" # コミット
git push                # プッシュ
```

### 権限・実行
```bash
chmod +x script.sh      # 実行権限付与
./script.sh            # スクリプト実行
```

## トラブルシューティングコマンド

### ブランチ確認・修正
```bash
git branch              # 現在ブランチ確認
git checkout -b 00X-... # 正しい形式でブランチ作成
```

### スクリプト権限確認
```bash
ls -la .specify/scripts/bash/  # 権限確認
chmod +x .specify/scripts/bash/*.sh  # 一括実行権限付与
```

### ファイル存在確認
```bash
test -f .specify/templates/plan-template.md && echo "exists" || echo "missing"
```