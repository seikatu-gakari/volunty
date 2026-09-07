import { expect, type Page, type TestInfo } from "@playwright/test";

const BIRTHDAY_VIEWPORTS = [320, 360, 390, 1280] as const;

/** 日付エラーがgridの外に表示され、狭い画面でも入力を修正できることを確認する。 */
export async function assertParticipantBirthdayErrorLayout(
  page: Page,
  submitLabel: string,
): Promise<void> {
  const originalUrl = page.url();
  await page.getByLabel("年").selectOption("2000");
  await page.getByLabel("月").selectOption("2");
  await page.getByLabel("日").selectOption("30");
  await page.getByLabel("都道府県").selectOption("東京都");
  await page.getByRole("button", { name: submitLabel, exact: true }).click();

  const day = page.getByLabel("日");
  const error = page.locator("#participant-birthday-error");
  await expect(page).toHaveURL(originalUrl);
  await expect(day).toBeFocused();
  await expect(day).toHaveAttribute("aria-describedby", "participant-birthday-error");
  await expect(error).toHaveText(
    "有効な生年月日を入力してください（未来の日付や存在しない日付は無効です）",
  );
  await expect(error).toBeInViewport();

  const position = await page.evaluate(() => {
    const grid = document.querySelector("[data-participant-birthday-grid]");
    const year = document.querySelector("#participant-birth-year");
    const month = document.querySelector("#participant-birth-month");
    const day = document.querySelector("#participant-birth-day");
    const error = document.querySelector("#participant-birthday-error");
    if (!grid || !year || !month || !day || !error) {
      throw new Error("生年月日の入力欄または日付エラーが見つかりません");
    }
    return {
      gridBottom: grid.getBoundingClientRect().bottom,
      errorTop: error.getBoundingClientRect().top,
      yearBottom: year.getBoundingClientRect().bottom,
      monthTop: month.getBoundingClientRect().top,
      dayTop: day.getBoundingClientRect().top,
      headerBottom: document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
    };
  });
  expect(position.errorTop).toBeGreaterThanOrEqual(position.gridBottom);
  expect(position.monthTop).toBeGreaterThanOrEqual(position.yearBottom);
  expect(position.dayTop).toBe(position.monthTop);
  expect(position.dayTop).toBeGreaterThanOrEqual(position.headerBottom + 16);

  await day.selectOption("29");
  await expect(error).toHaveCount(0);
}

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
      const yearCell = year?.parentElement;
      const birthDateGrid = year?.closest<HTMLElement>("[data-participant-birthday-grid]");

      if (!year || !month || !day || !yearCell || !birthDateGrid) {
        throw new Error("生年月日のselectまたはwrapperが見つかりません");
      }

      let card = birthDateGrid.parentElement;
      while (card && !card.className.includes("rounded-[10px]")) {
        card = card.parentElement;
      }

      const measureSelectedTextFit = (select: HTMLSelectElement): boolean => {
        const selectedLabel = select.selectedOptions[0]?.textContent?.trim() ?? "";
        const style = getComputedStyle(select);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("選択値の文字幅を計測できません");
        }

        context.font = style.font || `${style.fontSize} ${style.fontFamily}`;
        const horizontalPadding =
          Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
        const nativeArrowSpace = 24;
        const availableTextWidth =
          select.clientWidth - horizontalPadding - nativeArrowSpace;

        return context.measureText(selectedLabel).width <= availableTextWidth;
      };

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
        yearGridColumn: getComputedStyle(yearCell).gridColumn,
        selectedTextFits: [
          measureSelectedTextFit(year),
          measureSelectedTextFit(month),
          measureSelectedTextFit(day),
        ],
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
    expect(layout.selectedTextFits).toEqual([true, true, true]);

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
