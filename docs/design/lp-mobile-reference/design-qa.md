# 未ログインLP Design QA

## 対象

- source: `docs/design/lp-mobile-reference/01-hero.png` 〜 `06-faq-footer.png`
- implementation: `http://localhost:3000/`
- viewport: `390 × 844`
- state: 未ログイン、FAQ 2件目を展開、モバイルメニューを開閉

## 比較結果

生成元と実装を同じ入力内で比較するため、以下の左右比較画像を作成した。

- `qa/compare-01-hero.jpg`
- `qa/compare-02-pain.jpg`
- `qa/compare-03-usage.jpg`
- `qa/compare-04-benefits.jpg`
- `qa/compare-05-voices.jpg`
- `qa/compare-06-faq.jpg`

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

## チェック

- [x] ヒーローの見出し、ブランドカラー、清掃活動写真、2つのCTAを生成元に合わせた
- [x] 活動スタイル、課題、使い方、メリット、利用イメージに実画像を配置した
- [x] 角丸、薄い境界線、余白、見出し階層をモバイル基準で統一した
- [x] サービス名を「ボランティー」に統一した
- [x] モバイルメニューを開閉できる
- [x] FAQを開閉できる
- [x] CTAとヘッダーのリンク先が実在する
- [x] 表示中の画像に読み込み失敗がない
- [x] `document.documentElement.scrollWidth === 390` で横あふれがない
- [x] 生成元と実装を左右に並べて目視比較した

## 修正履歴

1. 旧LPの自動マーキー、CSSブロブ、グラデーション主体のカードを撤去した。
2. 生成写真16点と透明ブランドアセット2点を登録し、セクションごとに適切な比率で配置した。
3. 390px幅で見出しの折り返し、カード幅、横スクロール、FAQの密度を調整した。
4. 参照との左右比較後、ヘッダーのブランドマーク、後半セクションのアンカー、CTA装飾を最終調整した。

final result: passed
