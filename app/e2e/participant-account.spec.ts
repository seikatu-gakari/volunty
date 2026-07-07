import { resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const DELETE_PERSONA_EMAIL = "e2e-participant-delete@example.com";

/** 削除対象ユーザーの診断データ件数をDBから直接取得する */
async function countDiagnosisRows(): Promise<{
  results: number;
  responses: number;
}> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ results: string; responses: string }>(
      `SELECT
         (SELECT COUNT(*) FROM t_diagnosis_result r
            JOIN m_user u ON u.id = r.user_id
           WHERE u.email = $1) AS results,
         (SELECT COUNT(*) FROM t_diagnosis_response resp
            JOIN t_diagnosis_result r ON r.id = resp.diagnosis_result_id
            JOIN m_user u ON u.id = r.user_id
           WHERE u.email = $1) AS responses`,
      [DELETE_PERSONA_EMAIL]
    );
    return {
      results: Number(rows[0].results),
      responses: Number(rows[0].responses),
    };
  } finally {
    await client.end();
  }
}

test.describe("参加者のアカウント削除", () => {
  test.use({ storageState: "playwright/.auth/participant-delete.json" });

  test("P-15: アカウント削除で診断データも連鎖削除される", async ({ page }) => {
    // 前提: seed により削除専用 persona には診断結果が存在する
    const before = await countDiagnosisRows();
    expect(before.results).toBeGreaterThan(0);

    await page.goto("/mypage");
    await page.getByLabel(/確認のため/).fill("削除する");
    await page.getByRole("button", { name: "アカウントを削除" }).click();

    await expect(page.getByText("アカウントを削除しました")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    // 診断結果・生回答が残っていないこと（ON DELETE CASCADE）
    const after = await countDiagnosisRows();
    expect(after.results).toBe(0);
    expect(after.responses).toBe(0);
  });
});
