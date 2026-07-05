import { resolve } from "node:path";
import { test as setup } from "@playwright/test";

const personas = [
  { key: "participant-onboarded", file: "participant" },
  { key: "participant-fresh", file: "participant-fresh" },
  { key: "participant-diagnosis", file: "participant-diagnosis" },
  { key: "participant-lifecycle", file: "participant-lifecycle" },
  { key: "participant-delete", file: "participant-delete" },
  { key: "participant-suspendable", file: "participant-suspendable" },
  { key: "organization-approved", file: "organization" },
  { key: "organization-pending", file: "organization-pending" },
  { key: "organization-fresh", file: "organization-fresh" },
  { key: "organization-reapply", file: "organization-reapply" },
  { key: "organization-profile-review", file: "organization-profile-review" },
  { key: "organization-lifecycle", file: "organization-lifecycle" },
  { key: "organization-foreign", file: "organization-foreign" },
  { key: "admin", file: "admin" },
] as const;

for (const persona of personas) {
  setup(`authenticate as ${persona.key}`, async ({ page }) => {
    await page.goto(`/api/test-auth/login?persona=${persona.key}`);
    await page.waitForURL((url) => url.pathname !== "/api/test-auth/login");
    await page.context().storageState({
      path: resolve("playwright", ".auth", `${persona.file}.json`),
    });
  });
}
