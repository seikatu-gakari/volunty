import { expect, test } from "@playwright/test";

const PUBLIC_DOCUMENTS = [
  ["/terms", "利用規約"],
  ["/privacy", "プライバシーポリシー"],
  ["/operator", "運営者情報"],
  ["/contact", "お問い合わせ"],
  ["/safety", "安全・通報方針"],
  ["/account-deletion", "退会・データ削除"],
] as const;

test.describe("公開文書と登録前同意", () => {
  test("未ログインで各文書を閲覧でき、共通フッターから相互に到達できる", async ({
    page,
  }) => {
    for (const [path, heading] of PUBLIC_DOCUMENTS) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      const footer = page.locator("footer");
      await expect(footer.getByRole("link", { name: "利用規約", exact: true })).toHaveAttribute(
        "href",
        "/terms",
      );
      await expect(footer.getByRole("link", { name: "プライバシーポリシー", exact: true })).toHaveAttribute(
        "href",
        "/privacy",
      );
      await expect(footer.getByRole("link", { name: "退会・データ削除", exact: true })).toHaveAttribute(
        "href",
        "/account-deletion",
      );
    }
  });

  test("登録直前に同意対象と版を表示し、未同意では登録を開始しない", async ({ page }) => {
    await page.goto("/signup");

    const consent = page.getByRole("checkbox");
    const signup = page.getByRole("button", { name: "Googleで登録" });
    await expect(consent).toBeVisible();
    await expect(page.getByText("利用規約").first()).toBeVisible();
    await expect(page.getByText("プライバシーポリシー").first()).toBeVisible();
    await expect(page.getByText("版 2026-09-07").first()).toBeVisible();
    await expect(signup).toBeDisabled();

    await consent.check();
    await expect(signup).toBeEnabled();
  });
});
