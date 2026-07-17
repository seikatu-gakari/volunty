# 未ログインLP Design QA

## 対象

- 構成参照: `docs/design/lp-mobile-reference/01-hero.png` 〜 `06-faq-footer.png`
- 配色方向: `.superpowers/brainstorm/94684-1784211055/content/color-direction-v2.html` の `data-choice="a-balanced-pop"`
- implementation: `http://localhost:3000/`
- viewport: `390 × 844`
- state: 未ログイン、FAQ 2件目を展開、モバイルメニューを開閉

## 比較結果

### A. Balanced Pop 配色方向比較（6枚）

承認済みA案と実装を同じ画像内で比較するため、以下の左右比較画像を作成した。各画像の左側は旧 `compare-01-hero.jpg` の正常な左半分（390×844）から抽出した単一canonical素材、右側は対応する390×844の実装画面である。旧構成参照6画像はレイアウト・画像クロップの確認に使用し、現在の `compare-*.png` の左側には使用していない。

- `qa/compare-01-hero.png`: A案 / ヒーロー
- `qa/compare-02-pain.png`: A案 / 課題解決
- `qa/compare-03-usage.png`: A案 / 使い方
- `qa/compare-04-benefits.png`: A案 / メリット
- `qa/compare-05-voices.png`: A案 / 利用イメージ
- `qa/compare-06-faq.png`: A案 / FAQ 2件目展開

A案素材は旧 `compare-01-hero.jpg` の左半分だけを一度抽出し、6枚すべてへ同じpixel bufferを使用した。長尺ブラウザー撮影や分割撮影は再利用していない。比較画像はcanonical素材と実装画像を左右へ機械連結し、RGB PNGとして保存しただけで、生成・装飾・テキスト追加はしていない。最終PNGから再デコードした左半分のraw SHA-256は6/6で `9b89d146808fe08fa8f07c840f47726961b5907fcd8289933a311d32573da215` と一致した。各比較画像の左側だけで、ティールの「みつかる」、オレンジ・ティール・パープルの活動スタイルカード、オレンジ・ティール・イエロー・パープルの4色swatchを確認できる。

比較画像6枚は `file` で `PNG image data, 780 x 844, 8-bit/color RGB, non-interlaced` であることを確認した。特に `compare-02-pain.png`、`compare-03-usage.png`、`compare-05-voices.png` は原寸で個別に開き、広い黒領域がなく、canonical左と実装右が正常に表示されることを確認した。

### 元構成参照との構成比較（6枚）

元の構成参照 `01-hero.png` 〜 `06-faq-footer.png` と、対応する実装section画像を同じ780×844画像内で比較するため、次の `compare-reference-*.png` を追加した。これらは上記のA. Balanced Pop配色方向比較とは別用途であり、左側へ単一A canonicalを再利用していない。

- `qa/compare-reference-01-hero.png`: `01-hero.png` / `implementation-hero-390x844.png`
- `qa/compare-reference-02-pain.png`: `02-pain-points.png` / `implementation-kadai-390x844.png`
- `qa/compare-reference-03-usage.png`: `03-usage-types.png` / `implementation-usage-390x844.png`
- `qa/compare-reference-04-benefits.png`: `04-benefits.png` / `implementation-benefits-390x844.png`
- `qa/compare-reference-05-voices.png`: `05-voices-features.png` / `implementation-voices-390x844.png`
- `qa/compare-reference-06-faq.png`: `06-faq-footer.png` / `implementation-faq-390x844.png`

参照側はSharpのLanczos3、`fit: cover`、中央位置で390×844へaspectを維持して縮小した。852×1847の `04-benefits.png` は中央cropを伴い、ほかの852×1846画像も同じ決定的な処理を使用した。縮小後のreferenceと既存implementationをPNG raw RGBでデコードし、生成・装飾・テキスト追加をせず左右へ機械連結した。各sourceの状態とクロップは加工せず、referenceは左390px、implementationは右390pxへ配置している。

| 比較画像 | 左reference raw SHA-256 | 右implementation raw SHA-256 |
| --- | --- | --- |
| `compare-reference-01-hero.png` | `4070084ac7c778e209e4edcb6c7d7ac95e52a48cffa891795328d693e5554518` | `87115e1b90d587cd436fe44106b520110b4d35303a51d22102897a30d1b96a5e` |
| `compare-reference-02-pain.png` | `7aed31935ee628a8acb32f35a422a4d4180068a86c6b811bb937d029536bc9db` | `4d67a0b8d4fd6d4e870249bf527ac65e8ecf7d9e4328d7ed63dad95ea7c75bdf` |
| `compare-reference-03-usage.png` | `fc8fa742653324518734e7160502ed17035fef4fb0f50216f9d69dc08bafd872` | `3cfc0d4f1a83bf64ffe9430d77a0e5f39171e54bf18f2cc19d96a030b7eeac3f` |
| `compare-reference-04-benefits.png` | `8bd956dd38aa4c4d2208b6aeb58854e7d856590964f38416269f210cca180412` | `010260c29b58aaf5e8eb31e02ae8c4423d4124fb1f45786a6eeb74dba0c8d343` |
| `compare-reference-05-voices.png` | `824ba658c48c5a51f357ccb82bb4181d8da1176e654f59aaf56aa5966218fd1c` | `485817ad3470da116702844dc2f8e02b8987964bb81d8e43ac60d0bcbb811ed7` |
| `compare-reference-06-faq.png` | `dff4e297ac48746c70b8b6691534dce3d519677e09c628352ef40f9a3c8359e4` | `b8e4cb1e208a2dc0092aaf21b90367d262c7b2fcfac39c1450e3cd51c63210f6` |

左referenceのraw hashは6/6で互いに異なり、再実行した対応sourceのresize結果と一致した。右側は6/6で対応implementationのraw RGBと一致した。12枚（A配色比較6枚 + 元構成参照比較6枚）を目視し、黒化とNext.js indicatorがないことを確認した。

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

上記10枚は390×844、`qa/implementation-390x844.png` はページ全体の390×14622で、計11枚すべてがRGB PNGであることを確認した。full-pageのfile SHA-256は `2790184cb4adb6578d0f3202ea56ade714a77e8ab6735e58215280c9e67035be`、heroのfile SHA-256は `e78e0918a4b02dc766683529edcb4f07c52e7d3cb9ac24cd78c8b83fe58f6f3f` で、同一画像ではない。

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
- [x] `main` 内の表示画像17点の読み込み失敗とブラウザーconsole errorが0件であることを確認した
- [x] `document.documentElement.scrollWidth === 390` を確認した
- [x] 実装画像11枚の実体がPNGであることを確認した
- [x] 比較画像6枚を780×844のRGB PNGへ統一し、左canonicalと右implementationの画素一致を確認した
- [x] A配色比較6枚と元構成参照比較6枚を分離し、後者の左referenceと右implementationの画素対応を確認した

## 2026-07-17 最終QA

- Browser skillが選択したChromeで `http://localhost:3000/` を確認し、viewport overrideを使って390×844、1023×844、1024×844を実画面検査した。
- Next.js Dev ToolsのPreferencesで `Hide Dev Tools for this session` を実行し、撮影DOM上のindicator表示を除去した。撮影直前の `indicatorVisible` はfalseで、contact sheetとfull-pageにもindicatorがないことを目視した。
- 390×844でhero / styles / kadai / usage / types / benefits / voices / features / faq / startを再撮影した。濃色CTA、写真、見出し、カード、FAQ 2件目展開を確認した。
- `qa/implementation-390x844.png` はsection画像の複製ではなく、実ページ全体を一度に撮影した390×14622のRGB PNGへ復元した。
- モバイルメニューを開いて `#faq` へ遷移し、メニューが閉じることとFAQ 2件目を展開できることを確認した。
- `main` 内の画像17点は全件 `complete && naturalWidth > 0`、ブラウザーconsole errorは0件だった。
- 簡易診断CTAは2件とも `/diagnosis/trial`、活動CTAは2件とも `/opportunities`、ログインは `/login`、新規登録は `/signup` だった。
- heroを含む10セクションの左右境界はviewport内、`document.documentElement.scrollWidth === 390` だった。
- 1023pxではモバイルメニュー表示・デスクトップナビ非表示、1024pxではモバイルメニュー非表示・デスクトップナビ表示だった。両幅ともHeaderは高さ72px、`scrollHeight === clientHeight`、横あふれなしだった。
- 実装画像はsection 10枚が390×844、full-page 1枚が390×14622のRGB PNG、比較画像6枚は780×844のRGB PNGへ更新した。比較画像左側のraw SHA-256は6/6でcanonicalの `9b89d146808fe08fa8f07c840f47726961b5907fcd8289933a311d32573da215` と一致し、右側も6/6で対応するimplementationのraw SHA-256と一致した。
- `guards.spec.ts` の対象4ケースはREDでlocatorの曖昧さ2件を検出後、productionを変更せずlocatorを限定してGREENにした。指定grepはsetupを含め25/25 passed、`guards.spec.ts` 全体は28/28 passedだった。

final result: passed
