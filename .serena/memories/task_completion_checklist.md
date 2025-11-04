# タスク完了時の手順

## 開発完了時のチェックリスト

### 1. ドキュメント更新確認
- [ ] `specs/<feature>/tasks.md` - 実装タスクが完了マークされているか
- [ ] `specs/<feature>/notes.md` - 実装中の気づき・変更点が記録されているか
- [ ] `README.md` - 必要に応じて手順・説明が更新されているか

### 2. Copilot指示の更新
```bash
.specify/scripts/bash/update-agent-context.sh copilot
```
- `.github/copilot-instructions.md`が最新の技術スタックを反映しているか確認

### 3. 成果物の整合性確認
- [ ] `specs/<feature>/data-model.md` - エンティティとREADME用語の一致
- [ ] `specs/<feature>/contracts/` - API変更の明示（変更なしの場合も記録）
- [ ] `specs/<feature>/quickstart.md` - README手順との矛盾なし

### 4. フィーチャー切り替え時の再実行
新しいフィーチャーに移る場合：
```bash
.specify/scripts/bash/setup-plan.sh --json  # パス確認
.specify/scripts/bash/run-command.sh speckit.tasks  # タスク再生成
```

## テスト・検証

### 手動検証
- [ ] README記載手順の実行テスト
- [ ] スクリプト動作確認（`--json`オプション含む）
- [ ] 生成されたファイルの内容確認

### ドキュメント品質チェック
- [ ] Markdownリンクが正しく動作するか
- [ ] コードブロックの言語指定が適切か
- [ ] 表組みの表示が崩れていないか

## コミット・プッシュ前確認

### Git状態確認
```bash
git status                # 変更ファイル確認
git diff                  # 差分確認
```

### 不要ファイル除外確認
- [ ] 自動生成の一時ファイルが含まれていないか
- [ ] `.gitignore`に従って適切に除外されているか

### コミット実行
```bash
git add .
git commit -m "feat: [feature-name] 実装完了"
git push
```

## プルリクエスト・レビュー準備
- [ ] タスクとREADME手順の整合性確認
- [ ] 他のコントリビューター向けの`quickstart.md`更新
- [ ] Constitution Check（現在はプレースホルダー）