# 性格診断機能 機能・実装ドキュメント

## 1. 概要

ボランティア参加者の性格特性を BIG5（5因子）で測定する「性格傾向チェック」機能です。
質問は **IPIP Lexical Big-Five Factor Markers 日本語版** を使用し、
**全50問（`ipip-bfm-50-ja`）** と **簡易15問（`ipip-bfm-50-ja-brief15`）** の2モードを提供します。
出典・採点キー・バージョンまで追跡可能な形で実装しています。

- 尺度・ライセンス・設計の詳細: `docs/design/personality-matching-redesign.md`（簡易版追加の経緯は §3.1）
- 旧仕様（独自60問・独自の簡易16問/詳細60問の2モード・10類型の閾値判定）は廃止済み。
  現行の簡易15問モードは IPIP-BFM-50-JA の項目をそのまま抜粋したものであり、旧・独自16問版とは別物
- 簡易版（15項目）は特性あたり3項目のため内的一貫性は50項目版より低く、簡易版自体の心理測定的検証は
  行われていない。傾向をすばやく把握する目的に限定し、結果画面で全50問への案内を表示する

## 2. 機能一覧

### 2.1 診断ウィザード（/diagnosis）

- **開始画面**: 測定内容・非臨床であること・性格に良し悪しがないこと・データの利用方法を説明します。
  「簡易診断（15問・約2分）」「全50問でしっかり診断（約5〜8分）」の2モードから選択します。
  生回答は常に保存されます（アカウント削除時に連鎖削除）。
- **質問回答**: 選択したモードの質問を1ページ1問ずつ表示し、5件法（全く当てはまらない〜非常に当てはまる）で回答します。
- **進捗表示・戻る**: プログレスバーと「戻る」ボタンに対応。戻って回答し直すと変更回数が記録されます。
- **中断・再開**: 回答途中の状態を localStorage に保存し、次回アクセス時に「続きから再開」できます。
- **回答時間の計測**: 各質問の回答時間（ミリ秒）と総所要時間を記録します（回答品質判定用。スコアには影響しません）。

### 2.2 診断結果表示（/diagnosis/result）

- **主結果は5ドメインの連続スコア**: 外向性・協調性・誠実性・情緒安定性・知性・想像性の
  0〜100換算スコアをバーで表示し、高低それぞれを価値中立に説明します。
- **スコアの意味の明示**: 「回答の換算値であり、他の人の中での順位（percentile）ではない」ことを表示します。
  日本人向け標準化データが存在しないため、percentile・T得点・「上位◯%」は表示しません。
- **参考タイプ**: 10種類の「活動スタイル参考タイプ」を補助情報として表示します。
  「完全一致」「あなたはこのタイプです」の断定表現は廃止し、「〜に近い傾向があります」と説明します。
- **回答品質の注記**: 回答時間が極端に短い（too_fast）、同一選択肢の長い連続（straight_lining）、
  逆転項目との矛盾（inconsistent）を検出した場合、性格の評価ではない旨とともに注記します。
- **メタ情報**: 尺度名・版・診断実施日・非臨床であること・マッチングでの利用方法・再診断の扱いを表示します。
- **簡易版の注記**: 簡易15問モードの結果には、全50問版より結果の安定性が下がる旨と
  全50問診断への案内を表示します。

## 3. 技術仕様と実装詳細

### 3.1 ファイル構成

- `app/src/lib/diagnosis-scale/`: 心理測定コア（UI・DBから分離した純粋関数群）
    - `scale.ts`: `IPIP_BFM_50_JA`（全50項目）と `IPIP_BFM_50_JA_BRIEF15`（各ドメイン先頭3項目・
      displayOrder 1〜15を抜粋した簡易版）の採点キー・出典・ライセンス・バージョン
      （一次資料: https://ipip.ori.org/JapaneseBig-FiveFactorMarkers.htm / newBigFive5broadKey.htm / newPermission.htm）。
      `getScaleDefinition(mode)` でモードに応じた尺度定義を取得する
    - `scoring.ts`: 採点（バリデーション・逆転項目 `6-値`・raw score 合計・0〜100換算。尺度引数でモード非依存）
    - `quality.ts`: 回答品質判定（too_fast / straight_lining / inconsistent。閾値は項目数に応じて相対化）
    - `style-types.ts`: 活動スタイル参考タイプ（10種・代表プロファイルとの距離で参考分類。モード非依存）
    - `types.ts`: ドメイン型・`DiagnosisMode`・ラベル・価値中立な高低説明文
- `app/src/lib/diagnosis/`: アプリケーション層
    - `machine.ts`: XState フロー（idle → answering ⇄ BACK → completed、RESTORE で再開）。
      `context.mode`（full/brief）でモードを保持する
    - `actions.ts`: Server Actions（`submitDiagnosis` / `fetchDiagnosisResult`）。`mode` を受け取り
      対応する尺度で採点する
    - `types.ts`: 入出力型
- `app/src/app/diagnosis/`: UI（`DiagnosisWizard` / `QuestionCard` / `result/page.tsx`）

### 3.2 採点仕様

- 回答値: 整数1〜5のみ有効。不正ID・範囲外・重複・未回答はエラー（部分回答では採点しない）
- 逆転項目（-keyed）: `6 - 回答値`
- raw score: ドメイン内項目数の合計（全50問版は10〜50、簡易版は3〜15の整数・丸め誤差なし）
- 表示用スコア: `(raw - 項目数) / (項目数×4) * 100`（小数1桁）。母集団内の位置ではない
- 決定性: 同じ回答と同じバージョンから常に同じ結果（乱数・時刻に非依存）

### 3.3 バージョン管理

診断結果には以下を必ず保存し、再計算・再現を可能にしています。

| バージョン | 定数 | 初期値 |
| --- | --- | --- |
| 尺度（全50問） | `IPIP_BFM_50_JA.scaleVersion` | 1.0.0 |
| 尺度（簡易15問） | `IPIP_BFM_50_JA_BRIEF15.scaleVersion` | 1.0.0 |
| 採点アルゴリズム | `SCORING_ALGORITHM_VERSION` | 1.0.0 |
| 標準化データ | `NORMS_VERSION` | null（日本人標準化データなし） |
| 参考タイプ定義 | `STYLE_TYPE_VERSION` | 1.0.0 |
| 回答品質ルール | `QUALITY_RULE_VERSION` | 1.0.0 |

### 3.4 データ保存

- `t_diagnosis_result`: スコア・バージョン・品質フラグ・参考タイプID・所要時間
- `t_diagnosis_response`: 生回答（**常に**保存。アカウント削除で連鎖削除）
- `m_participant_profile.latest_diagnosis_result_id`: 最新結果への参照
- 団体側には参考タイプ名のみ開示し、生スコアは開示しません

## 4. マッチングとの関係

診断とマッチングは独立したモデルです。おすすめ案件はルールベースエンジン
（`app/src/lib/recommendations/engine.ts`、`MATCHING_RULE_VERSION` 管理）が
興味分野・地域・日程・参加形態・性格適合（活動スタイルタグへの加点のみ）・新着性で順位付けします。

- ハード条件（終了・定員・年齢要件）と相性ランキングを分離
- 性格スコアはハード条件に使用せず、未診断でも推薦は表示されます
- 推薦の生成・表示は `t_recommendation_log` に記録され、将来の精度評価に使用します

## 5. テスト

- 採点・逆転項目・不正回答・回答品質・参考タイプ: `app/src/lib/diagnosis-scale/*.test.ts`
- XState フロー: `app/src/lib/diagnosis/machine.test.ts`
- Server Actions: `app/src/lib/diagnosis/actions.test.ts`
- マッチングルール・推薦理由: `app/src/lib/recommendations/engine.test.ts`
- 診断画面: `app/src/app/diagnosis/components/DiagnosisWizard.test.tsx`
- E2E: `app/e2e/participant-diagnosis.spec.ts`
