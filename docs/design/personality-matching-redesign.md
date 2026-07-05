# 性格診断・マッチング基盤 再設計書（承認用）

- 作成日: 2026-07-04（2026-07-05 実装完了に伴い更新）
- ステータス: **承認済み・実装完了**（残: 開発DBのreset適用とE2E実行）
- 対象: 診断モデル（BIG5測定）とマッチングモデル（案件推薦）の全面再設計
- 前提: 開発段階のため既存データの保持・移行は不要

---

## 1. 現行実装の問題点（Phase 1 監査結果）

### 1.1 監査対象と確認結果

| 対象 | 確認結果 |
| --- | --- |
| `docs/design/personality-diagnosis-big5.md` | 独自60問+10類型+ユークリッド距離マッチングを規定。Phase 2としてBedrock解説生成・協調フィルタリング（重み40/40/20）を記載 |
| `app/src/lib/personality/` | `constants.ts` に独自60問（出典なし）と10類型閾値、`logic.ts` に平均→0-100変換とタイプ判定、`machine.ts` にXStateフロー |
| `app/src/lib/diagnosis/actions.ts` | 回答検証→スコア計算→`m_participant_profile.diagnosis_*` と `t_diagnosis_result` へ保存 |
| `app/src/lib/recommendations/matching.ts` | 参加者スコアと案件 `requirementTraits` のユークリッド距離を0-100化 |
| `app/src/lib/dashboard/recommended-participants.ts` | 団体側でも同じ距離計算。「特性差が10以内」を推薦理由として表示 |
| Prisma schema / migration / seed | `m_personality_type` マスタ、`diagnosis_type/scores/mode` 列、`requirement_traits`、`matching_method` enum。バージョン列なし。RLSポリシーなし |
| UT/E2E | `logic.test.ts`、`machine.test.ts`、`actions.test.ts`、`participant-diagnosis.spec.ts` 等が現行仕様に依存 |
| git 差分 | クリーン（作業ブランチ `claude/eloquent-borg-1f1c87`、未コミット変更なし） |

### 1.2 診断モデルの問題点

1. **設問の出典が存在しない**: 60問すべてが独自作成で、心理測定的な検証（因子構造・信頼性・妥当性）が一切ない。「検証済み尺度」としての根拠を主張できない。
2. **16問簡易モードの測定品質**: 特性あたり3〜4問で、内的一貫性を担保できる項目数ではない。しかも簡易/詳細の2モードは同一尺度上のスコアとして混在保存され、精度の異なるスコアが区別なくマッチングに使われる。
3. **0〜100正規化の意味が誤解を招く**: `(平均-1)/4*100` は回答の線形変換にすぎず、母集団内の位置（percentile）ではない。UIの「%」表記は「上位◯%」という誤読を誘発する。
4. **10類型の固定閾値が恣意的**: `min: 95` のような閾値は根拠がなく、ほとんどの回答者はどのタイプにも「完全一致」しない。フォールバックの「理想スコア = min+10 / max−10」も恣意的。優先順位による同点解決にも根拠がない。
5. **ユークリッド距離によるタイプ判定**: 5次元空間の距離に心理学的な意味づけがなく、「完全一致」「最も近いタイプ」という断定表現で表示される。
6. **バージョン管理が皆無**: 設問・採点・タイプ定義のどれにも版がなく、設問を変更すると過去の結果と現在の結果の比較可能性が壊れる。生回答も保存されないため再計算・検証ができない。
7. **回答品質の概念がない**: 全部同じ選択肢の回答でも正常な結果として保存される。回答時間も記録されない。

### 1.3 マッチングモデルの問題点

1. **「診断スコアが近い＝相性が良い」の単一ルール**: 案件の `requirementTraits`（団体が任意に設定した0-100値）との距離だけでマッチスコアを算出。診断とマッチングが混同されている。
2. **`requirementTraits` の設定根拠がない**: 団体が「外向性65」のような数値を直感で入力する前提で、その数値に予測妥当性はない。
3. **ハード条件とランキングが未分離**: 日程・地域・資格は推薦スコアと別次元の「参加可能性」だが、現在は地域・カテゴリの部分文字列フィルタ程度しかない。
4. **成果を検証するデータがない**: 推薦の表示・順位・応募・完了・満足度のイベントが記録されず、マッチング精度を将来評価する手段がない。
5. **投機的な設計残骸**: `matching_method` enum の `collaborative` / `ai_enhanced` / `hybrid`、`score_breakdown` は実装のない設計書上の構想が型として残っているだけ。
6. **設計書と実装の乖離**: 設計書のPhase 2（Bedrock・協調フィルタリング・KPI目標値）は未実装で、実装済み部分とも重み等が一致しない。BIG5スコアを特徴量にした協調フィルタリング等、手法自体に根拠のない記述もある。

### 1.4 旧方式削除の影響範囲

`grep` による利用箇所調査の結果、以下が影響を受ける（詳細は §13）:

- `app/src/lib/personality/`、`diagnosis/`、`recommendations/`、`dashboard/recommended-participants.ts`、`approaches/`、`mypage/`、`opportunities/`、`organizations/`、`participant-profile/server.ts`
- 画面: `diagnosis/`、`recommendations/`、`dashboard/participants/`、`dashboard/opportunities/[id]/applicants/`、`mypage/`、`opportunities/[id]/`、`organizations/[id]/`、LP（診断タイプカルーセル）
- DB: `m_personality_type`、`t_diagnosis_result`、`m_participant_profile.diagnosis_*`、`m_opportunity.requirement_traits`、`t_matching_candidate.match_score/score_breakdown/method`、`t_approach.match_score`
- テスト: 上記各ディレクトリのUT、E2E `participant-diagnosis.spec.ts`、`participant-discovery.spec.ts` ほか
- ドキュメント: `docs/design/personality-diagnosis-big5.md`、`api-architecture-big5.md`、`database-design.md`、`docs/architecture/basic-design.md`、`specs/personality-diagnosis-functionality.md`、`specs/features.json`

---

## 2. 候補尺度比較（Phase 2）

一次資料で確認した候補尺度の比較。**確認日はすべて 2026-07-04**。

| 項目 | IPIP-BFM-50 日本語訳 | IPIP-NEO-120/300 日本語訳 | TIPI-J | BFI-2-J | JBFS-SF | NEO-PI-R / NEO-FFI |
| --- | --- | --- | --- | --- | --- | --- |
| 尺度の版 | Goldberg Lexical Big-Five Factor Markers 50項目（Nakayama 訳） | Johnson IPIP-NEO-120 / Goldberg 300（Karlin 訳） | 10項目（小塩ら 2012） | 60項目（Yoshino ら 2022） | 26項目（Toyomoto ら 2022） | 240 / 60項目 |
| 設問数 | 50（各ドメイン10） | 120 / 300 | 10 | 60 | 26 | 240 / 60 |
| 測定ドメイン | BIG5 5ドメイン | 5ドメイン | 5ドメイン | 5ドメイン | 5ドメイン | 5ドメイン |
| ファセット | なし | 30ファセット | なし | 15ファセット | なし | 30ファセット |
| 原版の権利・商用利用 | **Public domain・商用可**（IPIPサイトに「any purpose, commercial or non-commercial」「permission has already been automatically granted」と明記） | 同左 | TIPI原版（Gosling）は自由使用可 | © 2015 John & Soto。**非商用限定**（"for non-commercial uses only"） | 不明（項目非公開） | **商用ライセンス製品**（PAR社） |
| 日本語版の権利・商用利用 | IPIPサイト掲載訳（public domainのIPIP項目群の一部として掲載）。**商用可** | 同左 | 開発者ページに「**商用利用は基本的に許可しない**（要相談）」と明記 | 原版の非商用制限に従属。**商用不可** | 項目が論文・補足資料で**非公開** | 日本語版も商用ライセンス |
| 日本語での信頼性・妥当性 | Rasch モデルによる日本人大学生対象の検証研究あり（Apple & Neff, 2012, Journal of Applied Measurement, 13, 1-21）。ただし古典的信頼性係数・再検査信頼性の網羅的報告は確認できず | **検証の公表を確認できず**。IPIPサイト自体が「翻訳の正確性は未検証」と明記 | 検証済み（パーソナリティ研究 21, 40-52） | 検証済み（Yoshino et al. 2022） | 大学生2標本で検証（ω=.74〜.85、CFA適合可） | 日本語版標準化済み |
| 検証研究の対象集団 / サンプル | 日本人大学生（Apple & Neff 2012・Rasch分析） | —（未検証） | 日本人成人・大学生 | 日本人成人 | 日本の大学生 845名+781名 | 日本人成人（商用標準化） |
| 採点キーの公開 | 原版の+/-キーが IPIP サイトで公開（日本語項目は英語原文と1対1対応） | 公開（IPIPサイト・Johnson 2014） | 論文・マニュアルで公開 | 原版フォームで公開 | 非公開 | 非公開（購入者のみ） |
| 日本人向け標準化データ | なし | なし | 研究データの平均値等はあるが商用利用可能な標準化データではない | なし（研究データのみ） | なし | あり（商用） |
| 想定回答時間 | 約5〜8分 | 約10〜15分 / 30分超 | 約1分 | 約5〜8分 | 約3分 | 30分超 / 10分 |
| Volunty適合性 | **高**: 商用可・項目数と負荷のバランス・採点キー公開 | 中: 商用可だが負荷大。未検証翻訳でファセット解釈は正当化できない | 低: 商用不可 | 低: 商用不可 | 低: 項目非公開 | 低: 有償 |
| 根拠URL | https://ipip.ori.org/JapaneseBig-FiveFactorMarkers.htm / https://ipip.ori.org/newBigFive5broadKey.htm / https://ipip.ori.org/newPermission.htm | https://ipip.ori.org/Japanese100-ItemIPIP-NEODomains.htm / https://ipip.ori.org/newItemTranslations.htm | https://jspp.gr.jp/doc/manual_TIPI-J.pdf / https://oshio.w.waseda.jp/archives/617 | https://www.colby.edu/wp-content/uploads/2025/03/bfi2-form-japanese.pdf / Berkeley Personality Lab | https://www.frontiersin.org/articles/10.3389/fpsyg.2022.862646/full | https://www.parinc.com/ |
| DOI | —（Goldberg 1992 のマーカーに基づく） | Johnson 2014: 10.1016/j.jrp.2014.05.003 | 10.2132/personality.21.40 | 10.1027/1015-5759/a000670 | 10.3389/fpsyg.2022.862646 | — |
| 採否 | **採用** | 不採用（負荷・未検証ファセット） | **不採用（商用利用不可）** | **不採用（非商用限定）** | **不採用（項目非公開）** | 不採用（有償） |

補足:

- 「無料公開」と「商用利用可能」は別であることを確認した。TIPI-J・BFI-2-J は無料公開だが商用不可。IPIP のみが「public domain・商用可」を一次資料で明言している。
- ユーザー提示の DOI 10.3389/fpsyg.2022.862646 は JBFS-SF の検証論文（CC-BY）だが、**論文ライセンスと尺度項目の利用権は別**であり、項目自体が論文中で公開されていないため採用できない。
- IPIP サイトの翻訳ポリシーページには「翻訳の正確性はIPIPプロジェクトでは検証していない」と明記されている。この制約は §16（保証できないこと）に反映する。

## 3. 推奨尺度

**IPIP-BFM-50 日本語訳（Lexical Big-Five Factor Markers、中山実訳、IPIPサイト掲載）を単一尺度として採用する。**

- 識別子: `ipip-bfm-50-ja` / 初期バージョン `1.0.0`
- 50項目・5ドメイン各10項目・回答形式は5件法（1=全く当てはまらない 〜 5=非常に当てはまる）
- 採点キーは原版（`newBigFive5broadKey.htm`）の +keyed / -keyed に従う。日本語項目は英語原文と1対1対応で管理する
- **簡易版は提供しない**。理由:
  - 現行16問モードは特性あたり3〜4問で測定品質を担保できない
  - 2モード並存はスコアの互換性・バージョン管理・UI説明をすべて複雑化する
  - 50問（5〜8分）は診断系サービスとして受容可能な負荷であり、離脱対策は中断・再開機能（§6.3）で行う
- **ファセットスコアは提供しない**。ファセットを提供する条件は「ファセット構造が日本語データで確認できていること」であり、現時点で満たさない。

## 4. ライセンス根拠

1. IPIP 公式の許諾ページ（https://ipip.ori.org/newPermission.htm、2026-07-04 確認）に以下が明記されている:
   - "the IPIP has been placed in the public domain"
   - "permission has already been automatically granted for any person to use IPIP items, scales, and inventories for **any purpose, commercial or non-commercial**"
   - 事前連絡・料金は不要（"It is not necessary to contact ... for permission"）
2. 日本語訳は IPIP 公式サイト内ページ（https://ipip.ori.org/JapaneseBig-FiveFactorMarkers.htm）に "Provided by Minoru Nakayama" として掲載されており、public domain の IPIP 資材の一部として配布されている。
3. 上記の根拠URL・確認日・原文引用は、実装時に尺度定数ファイルのヘッダコメントと本設計書の両方へ記録する。

## 5. 日本語での妥当性

**現状: 採用尺度の日本語版には日本人大学生を対象とした Rasch モデルによる検証研究が存在するが、標準化データはなく、検証は限定的である。**

- IPIP 公式サイトの当該日本語訳ページには、検証研究として
  Apple, M. T., & Neff, P. (2012). Using Rasch measurement to validate the Big Five factor marker
  questionnaire for a Japanese university population. *Journal of Applied Measurement, 13*, 1-21 が引用されている
  （実装時に一次資料ページで確認。尺度定数のメタデータにも記録済み）。
- ただし IPIP サイト自身は翻訳全般について「正確性は IPIP プロジェクトでは未検証」と明記しており、
  一般成人を含む日本人母集団での標準化・再検査信頼性の報告は確認できていない。
- 検証済みの日本語尺度（TIPI-J・BFI-2-J）は商用利用不可のため、本制約下では「商用可」と「検証済み」を両立する尺度は存在しない。
- 従って:
  - UI・LP・設計資料で「科学的に正確」「高精度」とは表示しない（§9）
  - percentile・T得点・「上位◯%」は表示しない（日本人標準化データがないため）
  - 生回答の同意付き保存（§8）により、将来自社データで信頼性（α/ω）・因子構造を検証できる状態を作る
  - 翻訳検証・パイロット調査・因子分析・標準化調査は未解決事項（§17）とする

---

## 6. 診断モデル設計（Phase 3）

### 6.1 尺度構造とバージョン管理

質問項目・採点キー・出典は **コード内の型付き定数**（`app/src/lib/diagnosis-scale/`）として一元管理する。DBには識別子と版のみ保存する。

```typescript
/** 尺度定義（単一の情報源）。出典・ライセンス・確認日をコードに記録する */
interface ScaleDefinition {
  scaleCode: 'ipip-bfm-50-ja'
  scaleVersion: string          // '1.0.0' — 項目文言・順序の変更で更新
  name: string                  // 'IPIP Lexical Big-Five Factor Markers 日本語版'
  sourceUrl: string             // ipip.ori.org の項目ページ
  scoringKeyUrl: string         // ipip.ori.org の採点キーページ
  license: string               // 'Public domain (IPIP)'
  licenseVerifiedAt: string     // '2026-07-04'
  items: ScaleItem[]            // 50項目
}

interface ScaleItem {
  itemCode: string              // 'ipip-bfm50-e01' 等（版をまたいで安定）
  textJa: string                // 日本語項目（Nakayama訳のまま。改変しない）
  textEnOriginal: string        // 対応する英語原文（出典との対応検証用）
  domain: Big5Domain            // 'extraversion' | ...
  keyed: '+' | '-'              // 原版採点キー
  displayOrder: number
}
```

- `SCORING_ALGORITHM_VERSION`（例 `1.0.0`）: 採点ロジックの版。丸めや品質判定の変更で更新
- `NORMS_VERSION`: 標準化データの版。**当面 `null`**（日本人標準化データがないため）
- `STYLE_TYPE_VERSION`: 参考タイプ定義（§6.4）の版
- 診断結果には上記すべての版を保存し、「同じ回答+同じ版=常に同じ結果」を保証する

### 6.2 採点

採点は UI・DB から分離した**決定的な純粋関数**として実装する。

1. **バリデーション**（エラーは日本語メッセージで型付き返却）:
   - 質問IDが尺度定義に存在しない → エラー
   - 回答値が整数1〜5以外 → エラー
   - 同一質問への重複回答 → エラー
   - 未回答項目あり → エラー（全50問必須。部分回答での採点はしない）
2. **逆転項目**: `-keyed` 項目は `6 - value` に変換
3. **raw score**: ドメインごとの項目合計（整数、範囲 10〜50）。丸め誤差が発生しない表現を正とする
4. **表示用スコア**: `(raw - 10) / 40 * 100` を小数1桁で保持し、表示時に整数へ丸める。**これは回答の線形変換であり、母集団内の位置ではない**ことを型名・ドキュメント・UIで明示する（名称は `scaledScore0to100`）
5. **標準得点・T得点・percentile**: `NORMS_VERSION` が null の間は**計算も表示もしない**。将来標準化データを得た場合のみ、その版を記録した上で追加する
6. **測定誤差**: ドメインごとの信頼区間は自社検証で α が得られるまで数値表示しない。代わりにUIで「±数点程度の揺らぎがある」定性的説明を行う
7. **ファセットスコア**: 算出しない（§3）
8. **再現性**: 乱数・時刻・外部状態に依存しない。公式採点キーから独立に手計算した fixture（満点・最低点・混在パターン）で検証する

### 6.3 回答品質

回答品質は**性格特性と別のメタデータ**として判定・保存する。スコア計算には影響させない。

| シグナル | 収集方法 | フラグ条件（初期値。versionで管理し調整可能） |
| --- | --- | --- |
| 異常に短い回答時間 | 項目ごとの経過ms + 総所要時間 | 総所要時間 < 50問 × 1.0秒 で `too_fast` |
| 同一選択肢の連続 | 回答列の最長ストリーク | 逆転項目をまたいで同値が15問以上連続で `straight_lining` |
| 矛盾した回答 | 同一ドメイン内の +keyed / -keyed 項目の相関的整合 | 逆転処理後のドメイン内分散が極端に大きい場合 `inconsistent`（閾値はパイロットで調整） |
| 回答の変更回数 | 項目ごとの変更カウント | フラグ化せず参考情報として保存 |
| 中断・再開 | セッションの再開回数・経過時間 | フラグ化せず参考情報として保存 |

- フラグが1つ以上ある場合、結果は保存するが UI に「回答時間が短いため、結果が実際の傾向とずれている可能性があります。再診断をおすすめします」等の**品質注記**を表示する
- 無効判定（保存拒否）はしない。品質フラグは分析・再診断推奨のための情報であり、**ユーザーの性格の評価ではない**ことを説明文で明示する
- 中断・再開: 回答途中の状態をクライアント（localStorage）に保持し、途中離脱後に再開できるようにする（50問化に伴う離脱対策）

### 6.4 診断結果

**BIG5の5ドメイン連続スコアを主結果とする。**

- 結果に含める情報:
  1. 5ドメインの表示用スコア（0〜100）と raw score
  2. 各ドメインの意味（高い/低いの両方向を価値中立に説明。§9）
  3. 尺度名と版（「IPIP Big-Five Factor Markers 日本語版 v1.0.0（50問）」）
  4. 診断実施日
  5. 回答品質注記(該当時)
  6. 測定上の限界（自己報告式であること、日本語版の検証が途上であること、±数点の揺らぎ）
  7. 非臨床診断であること（医療・心理臨床の診断ではない）
  8. マッチングでの利用方法（性格は複数あるマッチング要素の一つ。§7）
  9. 再診断はいつでも可能で、結果は変わりうること（最新の結果がマッチングに使われる）
- **10類型は「活動スタイルの参考情報」として再定義して存続**させる:
  - 名称・説明文は流用しつつ、判定は「5ドメインスコアと各タイプの代表プロファイルの近さによる参考分類」に一本化（「完全一致」の概念と priority を廃止）
  - 代表プロファイルは現行 criteria の中央値から機械的に導出し、`STYLE_TYPE_VERSION` で管理。**心理測定の本体ではなく理解補助のナラティブ**であることを型・UI・設計書に明記
  - 表現規則: 「あなたはこのタイプです」→「あなたの回答は◯◯タイプに近い傾向があります」。「この活動に向いています」→「◯◯のような活動で力を発揮しやすい傾向があります」。断定・適性保証・除外の表現を禁止

---

## 7. マッチングモデル設計（Phase 4）

**診断モデルとは独立に設計・評価する。性格は複数特徴の一つに格下げする。**

### 7.1 ハード条件（適格性フィルタ）とランキングの分離

| 層 | 内容 | 例 |
| --- | --- | --- |
| ハード条件 | 参加が不可能・不適法な案件を候補から外す | 募集ステータス（公開中のみ）、開催日が過去でない、定員充足、必須資格の不足、年齢等の法的・安全要件 |
| ランキング | 参加可能な案件の中の並び順 | 下記ルールベーススコア |

- **性格スコアはハード条件に使用しない**。性格だけで案件を表示対象から除外しない
- 地域・参加形態は初期実装では「ユーザーが操作できるフィルタ」として提供し、暗黙のハード条件にはしない（アクセシビリティ要件の入力が整うまで誤除外を避ける）

### 7.2 初期ルールベースモデル（`matching-rules v1.0.0`)

学習データがないため、**説明可能なルールベース**とする。「学習済み」「高精度」とは説明しない。

| ルール | 入力 | 正規化 | 重み | 欠損時 |
| --- | --- | --- | --- | --- |
| 興味分野一致 | 参加者 `interests` × 案件カテゴリ | 一致=1 / 不一致=0 | 0.35 | 重みを除外し再正規化 |
| 地域近接 | 参加者居住地・希望地 × 案件開催地/団体活動地域 | 都道府県一致=1、隣接・オンライン=0.5 等の段階値 | 0.15 | 同上 |
| 日程適合 | 参加者 `availability` × 案件日程 | 曜日・時間帯の重なり率 0〜1 | 0.15 | 同上 |
| 参加形態適合 | 参加者希望 × 案件 online/offline/hybrid | 一致=1 / hybrid=0.5 | 0.10 | 同上 |
| 性格適合 | 診断スコア × 案件の活動スタイルタグ | §7.3 の加点方式 0〜1 | 0.15 | 同上（未診断でも推薦は成立） |
| 新着性 | 公開からの経過日数 | 指数減衰 0〜1 | 0.10 | 公開日は必須のため欠損なし |

- 総合スコア = Σ(重み × 正規化値) / Σ(有効な重み)。0〜1 を内部値とし、UIには「マッチ度◯◯%」ではなく相対的な並び順と推薦理由で提示する
- 重みは恣意的な初期値であることを設計書・コードコメントに明記し、`matchingRuleVersion` で管理。イベントデータ蓄積後に再調整する

### 7.3 性格適合ルール（旧 `requirementTraits` の置き換え）

- 団体は数値ではなく、**活動スタイルタグ**（例: 「初対面の人と多く話す」「一人で集中する作業が中心」「計画どおりの進行が重要」「臨機応変さが必要」）を案件に最大3つ設定する
- 各タグは特定ドメインの高低方向にマップされる（例: 「初対面の人と多く話す」→ 外向性・高）。参加者スコアが同方向（表示用スコア60以上/40以下）なら加点、逆方向でも**減点はしない**（0点）
- ユークリッド距離・「求める人物像の数値入力」は全廃する

### 7.4 推薦理由

- 寄与が大きかったルール上位2件を日本語テンプレートで表示（例: 「興味分野『子ども支援』と一致」「土日の活動時間が合っています」「初対面の人と話す活動で、あなたの外向的な傾向が活きやすい内容です」）
- 推薦理由の生成にLLMは使用しない。テンプレートはルールと1対1対応でUTで検証する

### 7.5 将来の学習モデル（今回は実装しない）

以下の前提条件を満たすまで、学習モデルは実装せず**イベント収集と評価基盤まで**とする。

- 応募イベント: 最低でも数千件規模、参加完了+満足度: 数百件規模
- 目的変数の定義: 第一目標=応募転換、第二目標=参加完了・満足度4以上
- 学習/検証/テストの時系列分割（未来のデータでの検証）とデータリーク防止
- コールドスタート設計（新規ユーザー・新規案件はルールベースへフォールバック）
- 推薦によるフィードバックループ・選択バイアスへの対処（表示位置ログ・傾向スコアの記録）
- モデル比較・ロールバック・バージョン管理の手順

### 7.6 イベント設計

マッチング精度を将来評価できるよう、以下を記録する。個人情報は userId と案件ID以外持たせない。

| イベント | 記録内容 |
| --- | --- |
| 推薦生成・表示 | userId、opportunityId、表示順位、総合スコア、ルール別寄与、`matchingRuleVersion`、参照した `diagnosisResultId`（null可） |
| 募集詳細閲覧 / お気に入り | userId、opportunityId、発生時刻、流入元（推薦/検索/直接） |
| 応募・辞退 | 既存 `t_matching_candidate` のステータス遷移＋遷移時刻 |
| 団体の承認・不承認 | 同上 |
| 参加開始・完了・キャンセル | 同上（`completed` / 新設 `cancelled`） |
| 参加者評価・団体評価 | 新設テーブルに1〜5評価＋任意コメント |
| 継続参加 | 同一 userId の完了イベント列から導出（専用テーブル不要） |

### 7.7 評価指標（何を正解とするか）

| 指標 | 正解の定義 |
| --- | --- |
| Precision@K / Recall@K / NDCG@K | 「推薦表示後14日以内の応募」を正例とするオフライン評価 |
| 応募転換率 | 推薦表示 → 応募 |
| 参加完了率 / キャンセル率 | 応募承認 → 完了 / キャンセル |
| 参加者・団体満足度 | 完了後評価の平均と分布 |
| 継続参加率 | 完了後90日以内の再応募 |
| 校正 | 将来確率予測を出す場合のみ、予測確率と実測率の較正曲線 |
| 公平性 | 年代・地域・診断有無のグループ間で応募転換率・表示機会の差を監視 |
| 新規/既存ユーザー差 | 診断未実施・履歴なしユーザーの指標を分けて集計 |

診断モデルの精度（信頼性・妥当性）はこれらとは**別に**、蓄積した生回答による α/ω・因子分析で評価する（§17）。

---

## 8. データベース設計（Phase 5）

既存データの保持・移行・backfill・dual-read・互換adapterは行わない。**migration履歴を初期化し、新schemaを1本のinit migrationとして作り直す**（破壊的操作の実行前に確認を取る。§11 破壊的変更参照）。

### 8.1 削除するもの

- `m_personality_type` テーブル（タイプはコード定数へ）
- `m_participant_profile.diagnosis_type / diagnosis_scores / diagnosis_mode`
- `m_opportunity.requirement_traits`
- `t_diagnosis_result` の現行定義（`closest_type_distance` 等）
- `t_matching_candidate.match_score / score_breakdown / method` と `matching_method` enum
- `t_approach.match_score`

### 8.2 新規・変更テーブル（Prisma論理名）

```text
t_diagnosis_result（再定義）
  id, userId
  scaleCode, scaleVersion, scoringAlgorithmVersion, normsVersion(null可), styleTypeVersion
  rawScores JSONB        // {"extraversion": 34, ...} 整数合計
  scaledScores JSONB     // {"extraversion": 60.0, ...} 表示用
  styleTypeId String?    // 参考タイプID（コード定数のキー）
  qualityFlags JSONB     // ["too_fast", ...] 空配列可
  totalDurationMs Int, resumedCount Int
  answeredAt, createdAt
  → User onDelete: Cascade

t_diagnosis_response（新設: 生回答）
  id, diagnosisResultId FK(onDelete: Cascade), itemCode, value(1-5),
  elapsedMs, changedCount
  ※ 保存目的: 品質検証・尺度の自社検証（§17）。診断開始画面で同意を明示し、
    同意しない場合は結果のみ保存（レスポンス行を作らない）
  ※ 保持期間: 24ヶ月で匿名化バッチ（userIdとの紐付けを切る）を運用ルール化
  ※ ユーザー削除操作・アカウント削除で Cascade 削除

m_participant_profile（変更）
  latestDiagnosisResultId? FK(SetNull)  // 最新結果への参照に一本化

m_opportunity（変更）
  requirementTraits 削除
  activityStyleTags Json?   // 活動スタイルタグID配列（最大3）
  requiredQualifications Json?  // ハード条件: 必須資格
  minAge Int? / maxAge Int?     // ハード条件: 年齢要件（法的・安全上の場合のみ）

t_recommendation_log（新設）
  id, userId, opportunityId, rank, totalScore, ruleContributions JSONB,
  matchingRuleVersion, diagnosisResultId?, createdAt
  ※ 推薦生成＝表示単位で記録。閲覧・お気に入りは source 列を持つ
    t_engagement_event（event: view/favorite, source: recommendation/search/direct）へ

t_participation_feedback（新設）
  id, applicationId FK(t_matching_candidate, Cascade),
  raterRole (participant/organization), rating 1-5, comment?, createdAt
  @@unique([applicationId, raterRole])

t_matching_candidate（変更）
  matchScore/scoreBreakdown/method → 削除
  recommendationLogId? を追加（どの推薦から応募に至ったかの追跡）
  status に cancelled を追加
```

### 8.3 バージョン・再現性

- 診断結果行に尺度・採点・標準化・タイプ定義の4バージョンを必ず保存
- 推薦ログに `matchingRuleVersion` を必ず保存
- 生回答＋各バージョンから結果を決定的に再計算できることをUTで担保

### 8.4 アクセス制御・RLS

- 現状アプリは Prisma の直接続（RLSの適用外）で、認可は Server Actions 内のチェックに依存している
- 新設テーブルにも同じ方式を踏襲しつつ、**Supabase 側に防御層として RLS ポリシーを定義**する:
  - `t_diagnosis_result` / `t_diagnosis_response`: 本人（`auth.uid() = user_id`）のみ read。他ロールは不可
  - `t_recommendation_log` / `t_engagement_event`: 本人のみ read
  - `t_participation_feedback`: 当事者（参加者・対象団体）のみ read
  - anonキー経由の直接アクセスは全テーブル deny を既定とする
- 団体に診断の**生スコア一覧を見せない**。団体画面には参考タイプ名と活動スタイル適合の説明のみ表示する（現行は団体に5スコアを開示しており、これを廃止する）

### 8.5 seed

- seed から `m_personality_type` 投入を削除
- テスト案件は `requirementTraits` の代わりに `activityStyleTags`・カテゴリ・日程・参加形態を持たせる
- seed投入後に「診断→保存→推薦→応募」の主要フローが手元で確認できるデータ構成にする（E2E用 seed `app/scripts/seed-e2e.ts` も同様に更新）

---

## 9. UI・説明設計（Phase 6）

### 9.1 診断開始画面（新設する説明ブロック)

- 測定しているもの: 「BIG5と呼ばれる5つの性格特性の自己報告に基づく傾向」
- 測定していないもの: 「能力・適性・優劣・精神的な健康状態」
- 非臨床であること: 「医療・心理臨床の診断ではありません」
- 回答時の注意: 「正解はありません。深く考えすぎず、普段の自分に近いものを選んでください」
- データの扱い: 回答の保存目的・同意・削除方法へのリンク
- 所要時間: 「50問・約5〜8分。途中保存できます」

### 9.2 診断結果画面

- 5ドメインのスコアバー＋各ドメインの**両方向を価値中立に説明**（例: 外向性が低い=「少人数や静かな環境で力を発揮しやすい傾向」）。「性格に良し悪しはない」を明示
- スコアの意味: 「この数値はあなたの回答を0〜100に換算したもので、『他の人の中での順位』ではありません」
- 尺度名・版・実施日・回答品質注記を表示
- 参考タイプ: 「あなたの回答は◯◯タイプに近い傾向があります（結果を分かりやすくするための参考情報です）」
- マッチング利用の説明: 「おすすめ順は、興味分野・地域・日程などを主に、性格の傾向も一部参考にして決まります。性格を理由に応募できなくなることはありません」
- 再診断: 「回答はその時の状態で変わることがあります。いつでも再診断できます」
- 「完全一致」「最も近いタイプ」「この活動に向いています」の表記は全廃

### 9.3 推薦画面・団体側画面

- 案件カードに推薦理由チップ（最大2件）を表示し、性格以外の理由が主であることが視覚的に分かる構成にする
- 団体側の参加者一覧: 生スコア表示を廃止し、参考タイプと活動スタイル適合説明に置き換え
- LP（診断タイプカルーセル）・FAQ・`specs/` の診断説明を新仕様（50問・単一モード・傾向表現）へ更新
- 「高精度」「科学的に正確」等の根拠のない表現を使用しない。使用可能な表現は「国際的に公開されている性格研究用の質問項目（IPIP）を使用」まで

### 9.4 LLMの利用

- 診断採点・タイプ判定・マッチングスコア計算にLLMは使用しない
- 将来、結果の補助説明文生成に使う場合も、数値・特性値・推薦理由は入力値をそのまま表示し、LLM出力は「解説」ラベル付きの補助テキストに限定する（本設計の実装範囲外）

## 10. プライバシー・倫理

- 性格診断を医療・臨床診断、採用選考、参加可否の自動判定に使用しない
- 性格スコアだけで案件を表示対象から除外しない（§7.1）
- 団体へ生スコアを開示しない（§8.4）
- 生回答は同意ベースで保存し、目的（品質検証・尺度検証）を明示。アカウント削除で連鎖削除。24ヶ月で仮名化
- 品質フラグはユーザーの評価に使わず、再診断の案内のみに使う
- 未成年配慮: 年齢要件はハード条件として法的・安全上必要な場合のみ団体が設定できる

## 11. 破壊的変更の内容

- migration 履歴の初期化（既存 `app/prisma/migrations/*` を新 init migration に置き換え）と開発DBのreset。**実行前に改めて確認を取る**
- `m_personality_type` 等のテーブル・カラム削除（§8.1）
- 診断結果・案件の `requirementTraits` 等の既存データは復元不能になる（開発段階のため許容と指示済み）
- E2E・UTの大幅書き換え（16問フロー→50問フロー）

## 12. 評価計画・テスト戦略

### 12.1 テスト（TDD・実装前にREDを確認）

- 採点UT: 公式キーから独立計算した fixture（全項目1/全項目5/混在/逆転項目のみ）で検証
- バリデーションUT: 不正ID・範囲外・重複・欠損
- 回答品質UT: too_fast / straight_lining / inconsistent の境界値
- 参考タイプUT: 代表プロファイルとの距離判定・バージョン
- マッチングUT: ハード条件除外・各ルールの正規化・欠損時の再正規化・重み合成・推薦理由テンプレ
- Server Action UT: 認証・同意有無による保存分岐・バージョン保存
- XState UT: 50問遷移・BACK・中断再開・完了
- コンポーネントテスト: 診断画面・結果画面（品質注記・傾向表現）
- E2E: 診断開始→50問回答→保存→結果表示、推薦一覧と推薦理由、アカウント削除で診断データが消えること
- DB: 空DBからの schema 構築 → seed → 診断・推薦フロー確認

### 12.2 リリース後の評価

- 診断: 完了率・所要時間分布・品質フラグ率・（データ蓄積後）α/ω・因子構造
- マッチング: §7.7 の指標をイベントログから集計できる状態にする（ダッシュボードは範囲外）

## 13. 削除する旧実装

| 分類 | 削除対象 |
| --- | --- |
| 定数・型 | `BIG5_QUESTIONS` / `BIG5_QUESTIONS_BRIEF` / `BIG5_QUESTIONS_FULL` / `EXTRA_FULL_QUESTIONS` / `DiagnosisMode` / `DIAGNOSIS_MODE_CONFIG` / `PERSONALITY_TYPES`（現行形式） / `PersonalityType.criteria/priority` / `PersonalityProfile.closestType` |
| ロジック | `determinePersonalityType` / `findClosestPersonalityType` / `getIdealScore` / `calculateBIG5Diagnosis`（現行版） / `recommendations/matching.ts` のユークリッド距離 / `recommended-participants.ts` の距離ベース理由生成 |
| DB | §8.1 の全項目、`matching_method` enum |
| UI | 簡易/詳細モード選択、`ResultView` の「完全一致/最も近いタイプ」バッジ、団体側の生スコア表示、LPカルーセルの旧タイプ訴求文 |
| ドキュメント | `personality-diagnosis-big5.md`（本書で置換・アーカイブ）、`api-architecture-big5.md` の Bedrock/協調フィルタリング/KPI節、`database-design.md`・`basic-design.md`・`specs/*` の該当記述、`.claude/skills/volunty-architecture-design` 等の skill 記述 |

## 14. 実装ステップ（承認後・TDD）

1. 尺度定数（50項目＋採点キー＋出典メタ）と採点純粋関数 — UT先行
2. 回答品質判定関数 — UT先行
3. 参考タイプ（活動スタイル）判定 — UT先行
4. マッチングルールエンジン＋推薦理由 — UT先行
5. Prisma schema / init migration / seed 刷新（**DB reset前に確認**）
6. 診断 Server Actions（保存・取得・同意分岐）＋ XState 更新
7. 診断画面・結果画面の更新
8. 推薦 Server Actions・推薦画面・団体側画面の更新
9. イベントログ（推薦ログ・エンゲージメント・評価）
10. LP・FAQ・specs・skills・設計書の整合
11. 全UT / lint / 型チェック / build / E2E / 空DB構築 / seed / フロー確認

## 15. 現時点で保証できること

- 全設問・採点キーが public domain の一次資料（ipip.ori.org）まで追跡でき、商用利用可能の根拠が記録されている
- 同じ回答と同じバージョンから常に同じ結果が得られる（決定的採点）
- 診断とマッチングが独立したバージョン・独立した評価軸を持つ
- 性格スコアだけで参加機会が除外されない
- マッチング成果を将来検証するためのイベントが記録される

## 16. 現時点で保証できないこと

- **日本語版尺度の心理測定的な信頼性・妥当性の十分性**（大学生対象の Rasch 検証（Apple & Neff, 2012）はあるが、一般成人での検証・標準化・再検査信頼性は未確認）
- 日本人母集団内での位置（percentile・T得点）の提示
- マッチングの予測精度（重みは恣意的な初期値であり、成果データによる裏付けがない）
- 参考タイプ分類の心理学的な妥当性（UX上のナラティブに過ぎない）

## 17. 未解決事項

1. **尺度の自社検証計画**: 同意済み生回答が十分に集まった後の、信頼性（α/ω）・因子分析・（必要なら）項目改訂の実施時期と基準
2. 翻訳品質のレビュー: Nakayama 訳の項目文言について、公開時前に日本語話者パネルでの可読性確認を行うか（改変する場合は `scaleVersion` を更新し「独自改変版」であることを明示する必要がある）
3. パイロット調査・再検査信頼性・基準関連妥当性・標準化調査は未実施のまま残る
4. 活動スタイルタグの語彙設計と団体向け入力ガイドの詳細
5. 満足度評価の収集タイミング・督促UX
6. RLS の本格運用（Prisma接続との整合、service role の扱い）
7. 生回答の保持期間（仮案24ヶ月）と仮名化バッチの運用主体

---

## 参考資料（一次資料・確認日 2026-07-04）

- IPIP 利用許諾: https://ipip.ori.org/newPermission.htm
- IPIP 翻訳ポリシー: https://ipip.ori.org/newItemTranslations.htm
- IPIP-BFM-50 日本語訳: https://ipip.ori.org/JapaneseBig-FiveFactorMarkers.htm
- IPIP-BFM-50 採点キー: https://ipip.ori.org/newBigFive5broadKey.htm
- IPIP-NEO 日本語訳（不採用・比較用）: https://ipip.ori.org/Japanese100-ItemIPIP-NEODomains.htm
- TIPI-J マニュアル（商用不可の根拠）: https://jspp.gr.jp/doc/manual_TIPI-J.pdf
- BFI-2 日本語版フォーム（非商用限定の根拠）: https://www.colby.edu/wp-content/uploads/2025/03/bfi2-form-japanese.pdf / Berkeley Personality Lab https://www.ocf.berkeley.edu/~johnlab/bfi.html
- JBFS-SF 検証論文（項目非公開の確認）: https://doi.org/10.3389/fpsyg.2022.862646
