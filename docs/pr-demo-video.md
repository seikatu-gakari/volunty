# PR動作ビデオ運用

ユーザーに見える変更を、PR上のGIFとMP4で短時間に確認するための運用です。録画はCIローカルSupabase、合成E2Eデータ、既存テスト認証だけを使用し、本番・Vercel Preview・実ユーザーデータには接続しません。

## PR作成者の契約

PRテンプレートの `pr-demo:v1` blockを必ず1件だけ残します。

UI変更の例:

```text
<!-- pr-demo:v1
required: true
spec: e2e/participant-discovery.spec.ts
tag: @demo-221
viewports: desktop
reason:
-->
```

- `spec` は `app/e2e/` からの相対pathとして `e2e/*.spec.ts` を指定する。
- `tag` は `@demo-<Issue番号>` とし、指定spec内の該当テストを正確に1件にする。
- `viewports` は `desktop`、`mobile`、`desktop,mobile` のいずれかにする。通常は主対象1本、モバイル固有変更だけ2本にする。
- テスト名にtagを含め、日本語の `test.step` で変更点と操作を示す。
- 録画時間は15〜45秒、無音とする。通常E2Eとしても意味のある受入シナリオを既存テストへ追加または拡張する。

次のpath変更は自動的にUI変更と判定します。

- `app/src/app/**`（`app/src/app/api/**` とテストfileを除く）
- `app/public/**`
- `app/src/**` のCSS / SCSS

上記以外でも、表示文言・画面へ出る計算結果・設定などユーザー表示が変わる場合は `demo-video` ラベルで録画を必須化します。UIを変えないrefactorなどを対象外にする場合は、`required: false`、具体的な `reason`、`demo-not-required` ラベルの3点を揃えます。

## CIと公開

1. `Pull Request CI` が `in_progress` になると、main上のtrusted workflowが対象PRのcurrent HEADと同一HEADの最新CI run ID・`run_attempt` を照合し、forkを含む最新attemptのcommit status `demo-video` を直ちにpendingへ戻す。これにより、PR本文・label編集や同一HEADの再実行中に前回のsuccessを流用できず、古いrun・attemptの手動再実行も最新statusを上書きしない。
2. `demo-policy` がPR本文、label、変更pathを検証する。
3. 通常の全E2Eを録画なしで実行する。
4. DBを再初期化し、指定シナリオだけをdesktop 1280×720 / mobile 390×844で再実行する。
5. WebMをH.264 MP4と軽量GIFへ変換し、SHA-256・size・録画時間をmanifestへ記録する。decision、Playwright結果、demo結果のartifact名には `run_attempt` を含める。
6. completed `workflow_run` がmain上のtrusted codeだけをcheckoutし、GitHub APIのliveなPR本文・label・変更pathでpolicyを再評価してartifact decisionと照合する。同一HEADに複数の `Pull Request CI` runまたは再実行attemptがある場合は、対象PRの最新run numberに対応するrun ID・`run_attempt` だけを公開処理へ進め、最新runの照会自体に失敗した場合もfail closedにする。artifactは対象attempt固有名だけを選び、download前にAPI上の個数・圧縮sizeを制限し、許可file名・展開後size・圧縮率・symlink・path traversalを検証する専用展開処理を通す。さらにMP4のH.264・無音・viewport・時間、GIFのviewport・時間と全frame decode、identity、件数、hashを検証し、PR codeはcheckoutしない。
7. `gh-pages` はPRごとの最新HEADだけを持つroot commitへ置き換え、同じtreeをGitHub Pagesへdeployする。
8. SHA固有manifestの反映をHTTP確認し、今回配置したmanifest本文のSHA-256、`gh-pages` の永続化、対象run ID・`run_attempt` が同一HEADの最新CIであることを再照会する。すべて一致した場合だけPR commentをupsertし、commit status `demo-video` を成功にする。

生成失敗、tagの0件/複数件、不正path、古いSHA、Pages未反映は `demo-video` failureです。非UI PRは「対象外」としてsuccessになり、新規commentは作らず、既存のdemo commentがある場合だけ最新HEADの対象外表示へ更新します。

fork由来PRはread-only CIで録画まで行いますが、自動runではartifact自体をdownloadせず、公開もしません。maintainerが内容を確認後、Actionsの `Publish PR demo video` をmain refの `Run workflow` から開き、対象 `Pull Request CI` のrun IDを入力して手動承認します。workflow_dispatchを実行できるwrite権限とmain限定の `github-pages` environmentが承認境界になり、承認後もmain上のpublisherがartifactを再検証します。

## Ready判定

次がすべて同じHEADで成功した時だけReady扱いにします。

- `quality`
- `e2e`
- `demo-video`
- Vercel PreviewがReady
- Codex Reviewに未解決の重大指摘がない

通常のUI確認はPR内GIF / MP4で行います。OAuth、外部連携、本番固有設定、重大なresponsive変更は、上記に加えて人間がVercel Previewを確認します。`main` へのmergeは人間だけが行います。

## 保存とcleanup

Open中のPRは最新HEADだけを保持し、最新差分が対象外または生成失敗になった場合は旧HEAD動画も除去します。merge / closeから7日後、日次workflowがPagesから削除し、削除treeを `gh-pages` へ永続化してからPR commentを「保存期間終了」へ更新します。複数commentの途中でGitHub APIが失敗した場合は、hiddenな検証済み再試行stateを `gh-pages` に残し、次回runで全件を再試行します。全件成功後だけstateを除去します。Pages artifactはhidden fileを含めないため、この運用stateは公開siteへdeployしません。Pagesの1GB上限に対し、publisherはmedia合計900MiBを安全marginとして超過を拒否します。動画をmainやfeature branchへcommitしません。

## main merge後の有効化手順

基盤PRを人間がmainへmergeした後、次の順番で有効化します。GitHub設定を保存する直前に対象repositoryと変更内容を再確認します。

1. 空の `.nojekyll` だけを持つorphan `gh-pages` branchを作成する（最初のindexはpublisherが生成する）。
2. GitHub PagesのBuild and deployment Sourceを「GitHub Actions」にし、`github-pages` environmentのdeployment branchをmainに限定する。
3. `demo-video` と `demo-not-required` labelを作成する。
4. mergeしない一時E2E Issue / PRで、GIF、MP4、追加commit時のHEAD更新、契約失敗、docs-only対象外を実証する。
5. 実証後にmainのrequired status checksへ `demo-video` を追加する。
6. Symphonyの `WORKFLOW.md` をbackupして本書のReady条件へ更新し、service再起動後にactive状態とlogを確認する。

required check追加前にpilotを完了させることで、初期設定不足によるmainのlockoutを避けます。
