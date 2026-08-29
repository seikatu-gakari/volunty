import { RETENTION_DAYS, buildExpiredComment, shouldExpireDemo } from "./artifact.mjs";
import {
  listPublishedDemos,
  removeDemoFromSite,
  validateSiteDirectory,
} from "./site.mjs";

export async function cleanupExpiredDemos({ siteDirectory, client, now = new Date() }) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("cleanupの現在時刻が不正です");
  }

  await validateSiteDirectory(siteDirectory);
  const demos = await listPublishedDemos(siteDirectory);
  const seenPrNumbers = new Set();
  const removed = [];
  const expired = [];
  for (const demo of demos) {
    if (seenPrNumbers.has(demo.prNumber)) {
      throw new Error(`PR #${demo.prNumber}に複数の公開HEADがあります`);
    }
    seenPrNumbers.add(demo.prNumber);

    const pullRequest = await client.getPullRequest(demo.prNumber);
    if (
      !shouldExpireDemo({
        state: pullRequest.state,
        closedAt: pullRequest.closed_at,
        now,
        retentionDays: RETENTION_DAYS,
      })
    ) {
      continue;
    }

    await removeDemoFromSite(siteDirectory, demo.prNumber);
    removed.push(demo.prNumber);
    expired.push({ prNumber: demo.prNumber, headSha: demo.headSha });
  }

  await validateSiteDirectory(siteDirectory);
  return { removed, expired };
}

export async function finalizeExpiredComments({ expired, sitePersisted, client }) {
  if (sitePersisted !== true) {
    throw new Error("gh-pagesを永続化するまで期限切れcommentは更新できません");
  }
  for (const demo of expired) {
    await client.upsertDemoComment(
      demo.prNumber,
      buildExpiredComment({ headSha: demo.headSha }),
    );
  }
}
