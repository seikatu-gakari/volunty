# 未ログインLP Design QA

## 対象

- 構成参照: `docs/design/lp-mobile-reference/01-hero.png` 〜 `06-faq-footer.png`
- 配色方向: `.superpowers/brainstorm/94684-1784211055/content/color-direction-v2.html` の `data-choice="a-balanced-pop"`
- implementation: `http://localhost:3000/`
- viewport: `390 × 844`
- state: 未ログイン、FAQ 2件目を展開、モバイルメニューを開閉

## 比較結果

承認済みA案と実装を同じ画像内で比較するため、以下の左右比較画像を作成した。各画像の左側はブラウザーでA. Balanced Popのモック本体を撮影した同一素材、右側は対応する390×844の実装画面である。旧構成参照6画像はレイアウト・画像クロップの確認に使用し、現在の `compare-*.jpg` の左側には使用していない。

- `qa/compare-01-hero.jpg`: A案 / ヒーロー
- `qa/compare-02-pain.jpg`: A案 / 課題解決
- `qa/compare-03-usage.jpg`: A案 / 使い方
- `qa/compare-04-benefits.jpg`: A案 / メリット
- `qa/compare-05-voices.jpg`: A案 / 利用イメージ
- `qa/compare-06-faq.jpg`: A案 / FAQ 2件目展開

A案素材は同一DOM要素の可視領域を上600px・下126pxに分けてブラウザー撮影し、境界どおり縦連結した。比較画像はA案素材と実装画像を左右へ機械連結しただけで、生成・装飾・テキスト追加はしていない。各比較画像の左側だけで、ティールの「みつかる」、オレンジ・ティール・パープルの活動スタイルカード、オレンジ・ティール・イエロー・パープルの4色swatchを確認できる。

実装単体の確認画像:

- `qa/implementation-hero-390x844.png`
- `qa/implementation-styles-390x844.png`
- `qa/implementation-kadai-390x844.png`
- `qa/implementation-usage-390x844.png`
- `qa/implementation-types-390x844.png`
- `qa/implementation-benefits-390x844.png`
- `qa/implementation-voices-390x844.png`
- `qa/implementation-features-390x844.png`
- `qa/implementation-faq-390x844.png`
- `qa/implementation-start-390x844.png`

上記10枚と `qa/implementation-390x844.png` の計11枚は、`file` で `PNG image data` であることを確認した。

## チェック

- [x] ヒーローの見出し、ブランドカラー、清掃活動写真、2つのCTAを構成参照に合わせた
- [x] 活動スタイル、課題、使い方、メリット、利用イメージに実画像を配置した
- [x] 角丸、薄い境界線、余白、見出し階層をモバイル基準で統一した
- [x] サービス名を「ボランティー」に統一した
- [x] モバイルメニューを開閉できる
- [x] FAQを開閉できる
- [x] CTAとヘッダーのリンク先が実在する
- [x] 表示中の画像に読み込み失敗がない
- [x] `document.documentElement.scrollWidth === 390` で横あふれがない
- [x] 旧構成参照をレイアウト・画像クロップの確認に使用した
- [x] A. Balanced Popと実装を左右に並べて目視比較した

## 修正履歴

1. 旧LPの自動マーキー、CSSブロブ、グラデーション主体のカードを撤去した。
2. 生成写真16点と透明ブランドアセット2点を登録し、セクションごとに適切な比率で配置した。
3. 390px幅で見出しの折り返し、カード幅、横スクロール、FAQの密度を調整した。
4. 参照との左右比較後、ヘッダーのブランドマーク、後半セクションのアンカー、CTA装飾を最終調整した。

## Balanced Pop 更新

- source: `.superpowers/brainstorm/94684-1784211055/content/color-direction-v2.html` の A. Balanced Pop
- [x] A案sourceをブラウザー表示し、`data-choice="a-balanced-pop"` のモック本体を撮影した
- [x] 比較画像6枚の左側でティールの「みつかる」とオレンジ・ティール・パープルのカードを確認した
- [x] ブランドオレンジを主要CTAに維持した
- [x] ティール・イエロー・パープルをセクションとカードへ一貫して配分した
- [x] 問題・解決、FAQ開閉、導線が色だけに依存していない
- [x] 390px幅で横あふれがない
- [x] A案モックと実装を同一画像内で比較した
- [x] 強い色面が連続せず、写真とウォームホワイトの余白を維持した
- [x] 本文と白抜き文字の可読性、角丸、余白、画像クロップ、見出し折り返しに破綻がない
- [x] FAQ 2件目の展開、モバイルメニューの開閉、CTAリンクを実画面で確認した
- [x] 表示画像18点の読み込み失敗とブラウザーconsole errorが0件であることを確認した
- [x] `document.documentElement.scrollWidth === 390` を確認した
- [x] 実装画像11枚の実体がPNGであることを確認した

final result: passed
