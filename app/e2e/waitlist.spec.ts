import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

// CIの一時DBだけを使用する。実サービスURLへの流用は禁止。
test.describe("公開LPの待機リスト", () => {
  test.beforeAll(() => {
    const db = new URL(process.env.DATABASE_URL ?? "http://missing");
    if (!["localhost", "127.0.0.1", "::1"].includes(db.hostname)) throw new Error("待機リストE2EはローカルDB専用です");
  });
  for (const width of [390, 1440]) {
    test(`${width}pxでメールを登録し重複でも同じ結果になる`, async ({ page }) => {
      const email = `waitlist-${randomUUID()}@example.com`;
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator('a[href^="/login"], a[href^="/signup"], a[href^="/diagnosis"], a[href^="/opportunities"]')).toHaveCount(0);
      await page.getByRole("link", { name: "無料で開始通知を受け取る", exact: true }).click();
      const field = page.getByRole("textbox", { name: /メールアドレス/ });
      await field.fill(email);
      await page.locator("#waitlist").getByRole("button", { name: "開始通知を受け取る", exact: true }).click();
      await expect(page.locator("#waitlist").getByRole("status")).toContainText("開始通知の登録を受け付けました");
      expect(await prisma.waitlistEntry.count({ where: { email } })).toBe(1);
      await page.reload();
      await field.fill(email.toUpperCase());
      await page.locator("#waitlist").getByRole("button", { name: "開始通知を受け取る", exact: true }).click();
      await expect(page.locator("#waitlist").getByRole("status")).toContainText("開始通知の登録を受け付けました");
      expect(await prisma.waitlistEntry.count({ where: { email } })).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await prisma.waitlistEntry.deleteMany({ where: { email } });
    });
  }
  test("同時送信でも上限10件を超えず重複行を作らない", async ({ request }, testInfo) => {
    const email = `waitlist-concurrent-${randomUUID()}@example.com`;
    const origin = new URL(testInfo.project.use.baseURL!).origin;
    // このdescribeのbeforeAllでローカルDBに限定済み。専用E2Eの制限だけを初期化する。
    await prisma.waitlistRateLimit.deleteMany();
    const responses = await Promise.all(Array.from({ length: 12 }, () => request.post("/api/waitlist", {
      headers: { origin }, data: { email, website: "" },
    })));
    expect(responses.filter((response) => response.status() === 200)).toHaveLength(10);
    expect(responses.filter((response) => response.status() === 429)).toHaveLength(2);
    expect(await prisma.waitlistEntry.count({ where: { email } })).toBe(1);
    await prisma.waitlistEntry.deleteMany({ where: { email } });
    await prisma.waitlistRateLimit.deleteMany();
  });
  test("一時エラー後に入力を保持して再試行できる", async ({ page }) => {
    await page.route("**/api/waitlist", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "時間をおいてもう一度お試しください。" }) }));
    await page.goto("/#waitlist");
    const field = page.getByRole("textbox", { name: /メールアドレス/ });
    await field.fill("retry@example.com");
    await page.locator("#waitlist").getByRole("button", { name: "開始通知を受け取る", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(field).toHaveValue("retry@example.com");
    await expect(page.locator("#waitlist").getByRole("button", { name: "開始通知を受け取る", exact: true })).toBeEnabled();
  });
});
