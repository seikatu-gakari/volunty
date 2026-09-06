import { resolve } from "node:path";
import { test as setup } from "@playwright/test";

const personas = [
  { key: "participant-onboarded", file: "participant" },
  { key: "participant-fresh", file: "participant-fresh" },
  { key: "participant-diagnosis", file: "participant-diagnosis" },
  { key: "participant-lifecycle", file: "participant-lifecycle" },
  { key: "participant-delete", file: "participant-delete" },
  { key: "participant-logout", file: "participant-logout" },
  { key: "user-suspendable", file: "user-suspendable" },
  { key: "organization-approved", file: "organization" },
  { key: "organization-fresh", file: "organization-fresh" },
  { key: "organization-reapply", file: "organization-reapply" },
  { key: "organization-profile-review", file: "organization-profile-review" },
  { key: "organization-lifecycle", file: "organization-lifecycle" },
  {
    key: "organization-pending-readonly",
    file: "organization-pending-readonly",
  },
  { key: "organization-rejected", file: "organization-rejected" },
  { key: "organization-secondary", file: "organization-secondary" },
  { key: "admin", file: "admin" },
  { key: "admin-review", file: "admin-review" },
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
