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

元の構成参照と `qa/implementation-390x844.png` の同じ意味的セクション範囲を切り出し、次の `compare-reference-*.png` へ左右比較として配置した。上記のA. Balanced Pop配色方向比較とは別用途であり、左側へ単一A canonicalを再利用していない。

crop座標は `y開始:y終了`（終了は含まない）で記録する。03だけ活動スタイル10類型を欠かさないよう、`03-usage-types.png` の全体と `04-benefits.png` 冒頭を縦連結した。

| 比較画像 | 意味的範囲 | 左reference crop | 右implementation crop |
| --- | --- | --- | --- |
| `compare-reference-01-hero.png` | Hero | `01-hero.png` `y0:1300` | full-page `y0:980` |
| `compare-reference-02-pain.png` | 課題 | `02-pain-points.png` `y580:1600` | full-page `y1900:3220` |
| `compare-reference-03-usage.png` | 使い方・診断結果・活動スタイル10類型 | `03-usage-types.png` `y0:1846` + `04-benefits.png` `y0:420` | full-page `y3220:8150` |
| `compare-reference-04-benefits.png` | 参加メリット | `04-benefits.png` `y420:1580` | full-page `y8150:9750` |
| `compare-reference-05-voices.png` | 利用者の声・主な機能 | `05-voices-features.png` `y0:1640` | full-page `y9750:12370` |
| `compare-reference-06-faq.png` | FAQ・最終CTA・footer | `06-faq-footer.png` `y0:1846` | full-page `y12370:14622` |

各cropはSharpのLanczos3、`fit: contain`、中央位置、白背景で390×844へaspectを維持して収めた。生成・装飾・テキスト追加はせず、referenceを左390px、implementationを右390pxへPNG raw RGBで機械連結している。縦横比の差による余白は白であり、黒帯ではない。

| 比較画像 | 左reference raw SHA-256 | 右implementation raw SHA-256 |
| --- | --- | --- |
| `compare-reference-01-hero.png` | `bb43e4187a9293bf527a2d5484ea63c587d54adee31c6a59728db9203678875e` | `0a4e02c987ebaec557ace084dbe0de8bc2e5426387b1b1f8745798c18146637d` |
| `compare-reference-02-pain.png` | `44e86c9976e5c70af86d300d3d9fd114b527f466fec669948cf19d84ff56b3c3` | `6bb644f845bea86e0242c2ca76a228922117ee9fec030ca583336a7b0bd5ecd4` |
| `compare-reference-03-usage.png` | `ec984d72b59323d932abc353a20aca1fc7d193b03db4ee935ccb146b5219c9e3` | `542c8c89fc8ce245aec08cdab4750b23bf22de88cb19617eb010263e96fd4ea4` |
| `compare-reference-04-benefits.png` | `5ac664e22a303dac002bef56c368c177e34ca3458f311dbb3e91ea6daedbd768` | `918f3142dab3bc5616ec569ebbb83f007c14c3e78cfa3d60c33ef8626de10d57` |
| `compare-reference-05-voices.png` | `57eaeabc15adffc8b49119864c0e7973a8a0c845ec5563c4de9d5e15d3c37054` | `6d584c865d7b9834a6973eda71abc11eed6aca188c0c832a3412a40714f1bc07` |
| `compare-reference-06-faq.png` | `f72591d553185856a392ee74513657e975d0d24bfa549b27d817f08b8c017bd0` | `6dd10dfb24d228ea5eaeff89eee799751219414c1923e00cb97508a9cd4ce689` |

左右のraw hashは、記録cropから独立再計算した390×844 RGBと6/6で一致した。6枚のcontact sheetに加え、02課題と05利用者の声・主な機能を原寸で個別に開き、意味的な開始・終了、黒化なし、Next.js indicatorなしを確認した。A配色比較の `compare-*.png` 6枚は変更していない。

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
- `guards.spec.ts` はsetupを含め30/30 passedだった。390px・768px・1440pxでheroを含む全10セクションの境界、17画像の読み込み、主要CTA、横あふれを検証し、1023px・1024pxでは公開Headerのモバイル/デスクトップ切替も確認した。

## 2026-07-18 Photo Orbit更新

- 選択モック `concepts/photo-orbit-selected.png` と実装390×844を左右比較した。
- 既存写真5枚をメイン1枚・サブ4枚の非対称配置で表示し、単一写真だけの寂しさを解消した。
- モバイルではCTA→Photo Orbit→安心情報のDOM順、デスクトップでは左コピー／右Photo Orbitの構成を確認した。
- 390px・1024pxで写真の顔、白縁、重なり、横あふれ、画像読み込み、console errorを確認した。
- 日本語コピー、CTA、ヘッダー、認証分岐、後続セクションは変更していない。
- `qa/implementation-hero-photo-orbit-390x844.png` は390×844、`qa/implementation-hero-photo-orbit-1024x844.png` は1024×844、`qa/compare-photo-orbit-390x844.png` は780×844のRGB PNGとして保存した。
- モバイルで `main` 内の21画像が全件 `complete && naturalWidth > 0`、Photo Orbit内が5画像、`document.documentElement.scrollWidth === 390`、console error 0件であることを確認した。
- 1024pxでは公開ヘッダーがデスクトップ表示へ切り替わり、Photo Orbitが左カラムやヘッダーへ重ならず、横方向のオーバーフローもないことを確認した。
- 完了ゲートはUT 75ファイル・504件、lint、production build、`guards.spec.ts` 30/30件、`git diff --check` がすべて成功した。
- 最終レビュー後、1024pxの見出しサイズを調整して「変わっていく。」が1行に収まることを実測し、`qa/implementation-hero-photo-orbit-1024x844.png` を更新した。あわせてPhoto Orbitの画像配信上限と重要注記3箇所のコントラストを改善した。

final result: passed
