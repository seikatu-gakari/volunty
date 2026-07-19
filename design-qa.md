# Layered Paper Waves Design QA

## Comparison target

- Source visual truth:
  - `docs/design/lp-mobile-reference/concepts/layered-paper-waves-mobile-selected.png`
  - `docs/design/lp-mobile-reference/concepts/layered-paper-waves-desktop-selected.png`
- Implementation: unauthenticated `http://localhost:3000/`, top state, fresh load
- Viewports: `390x844`, `768x1024`, `1024x844`, `1440x1024`
- Implementation screenshots: `docs/design/lp-mobile-reference/qa/implementation-paper-waves-{390x844,768x1024,1024x844,1440x1024}.png`

## Evidence

- Full-view comparison:
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-mobile.png` (`780x844`)
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop.png` (`2880x1024`)
- Focused comparison:
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop-text-focus.png`
  - `docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop-photo-focus.png`
- Mobile typography and CTA are readable at native size in the full `780x844` comparison, so an additional mobile crop was not needed.
- Browser state: after the final production build, the development server was restarted before capture. All four viewports were opened fresh, every `main img` element was warmed and verified `21/21` complete with `naturalWidth>0`, and each viewport then returned to `scrollY=0`. All four captures had no horizontal overflow, issue badge, or development overlay. Fresh 390px and 1440px loads had zero console errors.

## Findings

- No actionable P0/P1/P2 findings remain.
- Typography: heading hierarchy, weight, Japanese wrapping, body leading, and CTA labels preserve the selected mock's optical hierarchy. The 1024px CTA labels are now one line; 1440px restores the larger CTA treatment.
- Spacing/layout: crown, outer rail, Photo Orbit divider, and lower paper boundary keep the cream reading surface clear. The 390/768/1024/1440 layouts have no clipping or horizontal overflow.
- Colors/tokens: cream, coral, teal, yellow, and purple remain consistent with the source. Paper layers are subordinate to photos and text.
- Image quality/assets: all five Hero images load and retain organic crops; the desktop focused comparison shows no stretching, halo, or placeholder substitution. The six paper assets are real WebP files, not CSS/SVG approximations.
- Copy/content: heading, body, CTA, trust copy, cards, and FAQ content remain coherent and unchanged.
- Interaction/accessibility: the 390px menu reaches `#faq`; FAQ question 2 opens and closes with the correct `aria-expanded` state; CTA hrefs are exact; paper backgrounds are `aria-hidden`; the 1023/1024 header switch passes regression coverage.

## Comparison history

1. Capture validation: the first set preserved the bottom scroll position and showed a development badge. It was rejected before design judgment and recaptured at the top without an overlay.
2. P0 — paper assets invisible: the backdrop used `-z-10` behind the stage's cream surface. `d094fc9` moved it to `z-0`; recapture confirmed visible crown/rail/divider layers.
3. P0 — rail covered headings and body copy: `6e30a5a` expanded the rail layer to 140%, restoring the central cream reading surface.
4. P0/P1 — journey/styles/trust rail anchoring still crossed copy, and the 768px Hero main image had an empty `currentSrc`: `2777efe` centered the rail anchors and aligned the Hero `sizes` value to its 576px tablet layout. Recapture confirmed readable stages and Hero images `5/5`.
5. P2 — the mobile/desktop paper flow did not visibly continue behind Photo Orbit: `d0c0794` placed the existing responsive divider behind the orbit. Recapture confirmed the teal/yellow/purple flow without text overlap.
6. P2 — 1024px CTA labels wrapped awkwardly: `b819d6a` was insufficient; `d2d4ea4` added a 1024px compact, no-wrap treatment and restored the normal treatment at `xl`. Browser metrics and recapture confirmed both labels on one line.
7. Final full-view and focused comparisons: no actionable P0/P1/P2 differences remained. Minor proportional differences are responsive implementation constraints and do not change hierarchy, readability, crop quality, or interaction.

## Browser checks

- 390px mobile menu: opened, scoped FAQ link navigated to `#faq`, target visible at the top, overflow `0`.
- FAQ question 2: opened (`aria-expanded=true`, answer visible) and closed (`aria-expanded=false`).
- Hero CTA hrefs: `/diagnosis/trial` and `/opportunities`.
- Background assets: Browser page-assets state downloaded mobile `3/3` and desktop `3/3`, failed `0`; direct HTTP verification returned `200` for all six URLs.
- Console: fresh 390px and 1440px loads had `0` errors. Running `next build` while the development server still used the same `.next` output briefly produced a stale hydration issue badge in QA; restarting the development server cleared it. The server restart preceded all final captures, and the badge is absent from every committed image.
- Background abort fallback: `guards.spec.ts` aborts all paper WebP requests and confirms the Hero heading, both CTA hrefs, four stages, and width remain usable.

## Verification

- `npm exec vitest run src/app/components/lp/LPPaperStage.test.tsx src/app/components/lp/HeroPhotoOrbit.test.tsx src/app/components/lp/LPHeroSection.test.tsx` — 14/14 passed.
- `npm run lint` — passed; only the existing `baseline-browser-mapping` update notice was printed.
- `npx playwright test e2e/guards.spec.ts --project=chromium` — 32/32 passed, including background-abort fallback, the 1023/1024 header regression, and a 1024px Hero CTA single-line assertion.
- `npm run build` — passed; 32/32 pages generated. Existing caught dynamic-route cookie diagnostics were printed during static collection.

final result: passed
