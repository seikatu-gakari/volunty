import { expect, type Page, type TestInfo } from "@playwright/test";

const BIRTHDAY_VIEWPORTS = [320, 360, 390, 1280] as const;

/** 生年月日の選択値が各対象幅で読み取れるレイアウトか確認する。 */
export async function assertParticipantBirthdayLayout(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  for (const [index, width] of BIRTHDAY_VIEWPORTS.entries()) {
    await page.setViewportSize({ width, height: 740 });
    await page.reload();

    const year = page.getByLabel("年");
    const month = page.getByLabel("月");
    const day = page.getByLabel("日");

    await expect(year).toBeVisible();
    await year.selectOption("2000");
    await month.selectOption("12");
    await day.selectOption("31");
    await expect(year).toHaveValue("2000");
    await expect(month).toHaveValue("12");
    await expect(day).toHaveValue("31");

    const layout = await page.evaluate(() => {
      const year = document.querySelector<HTMLSelectElement>('select[aria-label="年"]');
      const month = document.querySelector<HTMLSelectElement>('select[aria-label="月"]');
      const day = document.querySelector<HTMLSelectElement>('select[aria-label="日"]');
      const birthDateGrid = year?.parentElement;

      if (!year || !month || !day || !birthDateGrid) {
        throw new Error("生年月日のselectまたはwrapperが見つかりません");
      }

      let card = birthDateGrid.parentElement;
      while (card && !card.className.includes("rounded-[10px]")) {
        card = card.parentElement;
      }

      return {
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        cardClientWidth: card?.clientWidth ?? null,
        cardScrollWidth: card?.scrollWidth ?? null,
        birthDateGridClientWidth: birthDateGrid.clientWidth,
        birthDateGridScrollWidth: birthDateGrid.scrollWidth,
        yearWidth: year.getBoundingClientRect().width,
        monthWidth: month.getBoundingClientRect().width,
        dayWidth: day.getBoundingClientRect().width,
        yearGridColumn: getComputedStyle(year).gridColumn,
        selectedLabels: [
          year.selectedOptions[0]?.textContent?.trim(),
          month.selectedOptions[0]?.textContent?.trim(),
          day.selectedOptions[0]?.textContent?.trim(),
        ],
      };
    });

    expect(layout.documentScrollWidth).toBeLessThanOrEqual(width);
    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(width);
    expect(layout.cardScrollWidth).toBeLessThanOrEqual(layout.cardClientWidth ?? width);
    expect(layout.birthDateGridScrollWidth).toBeLessThanOrEqual(
      layout.birthDateGridClientWidth,
    );
    expect(layout.selectedLabels).toEqual(["2000年", "12月", "31日"]);

    if (width < 640) {
      expect(layout.yearGridColumn).toContain("span 2");
      expect(layout.yearWidth).toBeGreaterThanOrEqual(200);
      expect(layout.monthWidth).toBeGreaterThanOrEqual(100);
      expect(layout.dayWidth).toBeGreaterThanOrEqual(100);
    } else {
      expect(layout.yearGridColumn).not.toContain("span 2");
      expect(layout.yearWidth).toBeGreaterThanOrEqual(112);
      expect(layout.monthWidth).toBeGreaterThanOrEqual(80);
      expect(layout.dayWidth).toBeGreaterThanOrEqual(80);
    }

    if (index === 0) {
      await year.focus();
      await page.keyboard.press("Tab");
      await expect(month).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(day).toBeFocused();
    }

    await testInfo.attach(`生年月日-${width}px`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  }
}
