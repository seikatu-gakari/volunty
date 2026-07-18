# Layered Paper Waves Design QA

## 対象と状態

- 選択モック:
  - `docs/design/lp-mobile-reference/concepts/layered-paper-waves-mobile-selected.png` (`852x1846`)
  - `docs/design/lp-mobile-reference/concepts/layered-paper-waves-desktop-selected.png` (`1487x1058`)
- 実装: 未ログインの `/`、fresh load、ページ先頭、通常テーマ
- Browser: Codex in-app Browser
- 実装スクリーンショット:
  - `docs/design/lp-mobile-reference/qa/implementation-paper-waves-390x844.png`
  - `docs/design/lp-mobile-reference/qa/implementation-paper-waves-768x1024.png`
  - `docs/design/lp-mobile-reference/qa/implementation-paper-waves-1024x844.png`
  - `docs/design/lp-mobile-reference/qa/implementation-paper-waves-1440x1024.png`
- 同一キャンバス比較:
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-mobile.png` (`780x844`)
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop.png` (`2880x1024`)
- focused comparison:
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop-text-focus.png`
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop-photo-focus.png`
  - mobile は `780x844` のfull comparisonで見出し・CTA・画像境界をnative相当で判読できるため追加crop不要。

## viewport別結果

| viewport | 横あふれ | 継ぎ目・紙境界 | 文字・CTA重なり | 画像クロップ | Header |
| --- | --- | --- | --- | --- | --- |
| 390x844 | なし | crownからPhoto Orbit背面のdividerへ連続 | なし、CTAはOrbitより前 | Hero 5枚表示、自然な輪郭 | mobile |
| 768x1024 | なし | crown、外周rail、Orbit背面dividerが連続 | なし | Hero 5枚表示。main画像は補正後に読込 | mobile |
| 1024x844 | なし | desktop assetへ切替、外周と下端に展開 | なし。CTA 2件とも1行 | Hero 5枚表示、欠落なし | desktop |
| 1440x1024 | なし | 横長dividerが下端へ広がる | なし | sourceと同じ5枚構成、伸長・haloなし | desktop |

最終capture前に各幅で全`main img`をwarmupし、390/768/1024/1440のすべてで`21/21` completeかつ`naturalWidth>0`、failed `[]`を確認した。その後`scrollY=0`へ戻し、全幅で横あふれ`0`、開発overlayなし。fresh 390px / 1440px のconsole errorは `0`。同一dev tabを390pxから1440pxへresizeして再navigateした診断時のみNext.js hydration overlayを1回観測したが、fresh navigationでは再現せず、最終captureには含まれない。

## fidelity surfaces

- フォント・タイポグラフィ: 太いHero見出し、本文、CTA、補助テキストの階層はsourceと一致する。1024pxのCTA 1文字折返しは修正済み。切れ・省略なし。
- spacing・layout rhythm: crown、cream reading surface、Photo Orbit、dividerの順序を維持。カード・FAQ・CTAは紙境界から離れ、4幅で横幅内に収まる。
- colors・tokens: cream/coral/teal/yellow/purpleのバランスを維持。紙面が写真や本文より強くならない。
- image quality・asset fidelity: source写真を再利用し、5枚すべて適切なcropと解像度。紙レイヤーは6枚のWebP assetで、CSS art・inline SVG・placeholderへの置換なし。
- copy/content: 見出し、本文、主要/副CTA、trust items、カード、FAQの日本語を保持。
- icons/states/accessibility: 既存icon familyを維持。背景は`aria-hidden`。menuとFAQのopen/close state、リンク、1023/1024 Header切替を確認。

## 操作確認

- 390pxでメニューを開く: 成功（button 1、mobile navigation表示）。
- mobile navigationの「よくある質問」: `#faq`へ遷移し、対象が表示されtop付近、overflow `0`。
- FAQ 2問目「診断はどのくらい時間がかかりますか？」: openで`aria-expanded=true`かつ回答表示、closeで`false`。
- 主要CTA: `/diagnosis/trial`。
- 副CTA: `/opportunities`。
- `guards.spec.ts`は紙背景の全WebP requestをabortし、Hero見出し、CTA 2件、4 stage、390px横幅を維持するケースをGREENで確認。

## 背景asset配信

Browserのpage-assets状態でmobile `3/3`、desktop `3/3` がdownloaded、failed `0`。同じ6 URLをHTTPでも確認し、すべて`200`。

| asset | 寸法 | byte | HTTP |
| --- | ---: | ---: | ---: |
| `crown-mobile.webp` | 960x480 | 17,266 | 200 |
| `rail-mobile.webp` | 960x960 | 20,470 | 200 |
| `divider-mobile.webp` | 960x360 | 13,636 | 200 |
| `crown-desktop.webp` | 1920x420 | 13,414 | 200 |
| `rail-desktop.webp` | 1920x900 | 37,054 | 200 |
| `divider-desktop.webp` | 1920x320 | 19,450 | 200 |

## findings / comparison history

1. 初回captureはbottom scroll stateと開発badgeを含んだため比較前に破棄。top・overlayなしで再capture。
2. **P0: 紙背景が不可視** — `-z-10`がcream surfaceの背面へ沈んでいた。`d094fc9`で`z-0`へ変更し、post-fix captureで表示を確認。
3. **P0: railが見出し・本文へ侵入** — `6e30a5a`でrailを140%へ外側配置し、中央cream面を回復。
4. **P0/P1: 中盤railの片寄りと768px Hero main画像欠落** — `2777efe`でjourney/styles/trustをcenter anchorへ統一し、tabletの実幅576pxを`sizes`へ反映。post-fix stage cropsと768px captureで解消。
5. **P2: Photo Orbitから次sectionへの紙の流れが弱い** — `d0c0794`で既存divider assetをresponsiveにOrbit背面へ配置。mobile/desktop比較で流れを確認。
6. **P2: 1024px CTAの1文字折返し** — `b819d6a`だけでは残存。`d2d4ea4`でlg時のcompact/nowrapとxl復帰を適用し、実測`clientWidth===scrollWidth`、1行表示を確認。
7. 最終full comparison、desktop text/photo focused comparison、768/1024個別画像、中盤stage cropsを目視。actionableなP0/P1/P2は残っていない。

## verification

| 区分 | 判定 | 追加・更新したテスト | RED/GREEN | 最終結果 |
| --- | --- | --- | --- | --- |
| UT | 必須 | `LPPaperStage.test.tsx`, `HeroPhotoOrbit.test.tsx`, `LPHeroSection.test.tsx` | 各visual bugでRED確認後GREEN | 14/14 passed |
| E2E | 必須 | `guards.spec.ts`（fallback・responsive/header回帰を含む） | 768 image候補の途中失敗を修正後GREEN | 31/31 passed |

- `npm exec vitest run src/app/components/lp/LPPaperStage.test.tsx src/app/components/lp/HeroPhotoOrbit.test.tsx src/app/components/lp/LPHeroSection.test.tsx`: 3 files、14 tests passed。
- `npm run lint`: exit 0。既存の`baseline-browser-mapping`更新案内のみ。
- `npx playwright test e2e/guards.spec.ts --project=chromium`: 31/31 passed。
- `npm run build`: exit 0、32/32 pages generated。dynamic routeのcookie利用に関する既存のcatch済み診断ログあり。

## 残りのpolish

- P3: sourceと実装にはresponsive制約によるPhoto Orbitの大きさ・本文折返しの軽微差があるが、階層、可読性、crop、操作を変えないためblocking対象外。

final result: passed
