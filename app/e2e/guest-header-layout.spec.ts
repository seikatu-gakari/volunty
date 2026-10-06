import { expect, test } from '@playwright/test';

test.describe('未ログイン診断ヘッダーの狭幅表示', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const width of [320, 390, 1280]) {
    test(`${width}pxでログイン・登録を折り返さず操作できる`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/diagnosis/trial');
      const header = page.locator('header');
      const logo = header.getByRole('link', { name: 'ボランティ ホーム' });
      const login = header.getByRole('link', { name: 'ログイン', exact: true });
      const signup = header.getByRole('link', { name: '新規登録', exact: true });
      await expect(login).toHaveAttribute('href', '/login');
      await expect(signup).toHaveAttribute('href', '/signup');
      const logoBox = await logo.boundingBox();
      const loginBox = await login.boundingBox();
      const signupBox = await signup.boundingBox();
      expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(loginBox!.x);
      expect(loginBox!.x + loginBox!.width).toBeLessThanOrEqual(signupBox!.x);
      expect(signupBox!.x + signupBox!.width).toBeLessThanOrEqual(width);
      for (const link of [login, signup]) {
        await expect(link).toBeVisible();
        const lines = await link.evaluate((element) => {
          const text = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
          if (!text) return 0;
          const range = document.createRange(); range.selectNodeContents(text);
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.y))).size;
        });
        expect(lines).toBe(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await testInfo.attach(`guest-header-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      await login.click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/diagnosis\/trial$/);
      await signup.click();
      await expect(page).toHaveURL(/\/signup$/);
    });
  }
});
