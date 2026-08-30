import {
  RETENTION_DAYS,
  buildExpiredComment,
  shouldExpireDemo,
} from "./artifact.mjs";
import {
  listPublishedDemos,
  readPendingCleanup,
  removeDemoFromSite,
  validateSiteDirectory,
  writePendingCleanup,
} from "./site.mjs";

export async function cleanupExpiredDemos({ siteDirectory, client, now = new Date() }) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("cleanupの現在時刻が不正です");
  }

  await validateSiteDirectory(siteDirectory);
  const demos = await listPublishedDemos(siteDirectory);
  const pending = await readPendingCleanup(siteDirectory);
  const pendingByPrNumber = new Map(
    pending.map((entry) => [entry.prNumber, entry]),
  );
  const seenPrNumbers = new Set();
  const removed = [];
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
    const existing = pendingByPrNumber.get(demo.prNumber);
    if (existing && existing.headSha !== demo.headSha) {
      throw new Error(`PR #${demo.prNumber}のcleanup再試行HEADが一致しません`);
    }
    pendingByPrNumber.set(demo.prNumber, {
      prNumber: demo.prNumber,
      headSha: demo.headSha,
    });
  }

  const expired = await writePendingCleanup(
    siteDirectory,
    [...pendingByPrNumber.values()],
  );
  await validateSiteDirectory(siteDirectory);
  return {
    removed,
    expired,
    requiresDeployment: expired.length > 0,
  };
}

export async function finalizeExpiredComments({
  expired,
  siteDirectory,
  sitePersisted,
  pagesDeployed,
  client,
}) {
  if (sitePersisted !== true) {
    throw new Error("gh-pagesを永続化するまで期限切れcommentは更新できません");
  }
  if (pagesDeployed !== true) {
    throw new Error("Pagesへcleanup結果をdeployするまで期限切れcommentは更新できません");
  }
  await validateSiteDirectory(siteDirectory);
  const pending = await readPendingCleanup(siteDirectory);
  const expected = [...expired].sort(
    (left, right) => left.prNumber - right.prNumber,
  );
  if (JSON.stringify(pending) !== JSON.stringify(expected)) {
    throw new Error("cleanup resultとgh-pagesの再試行stateが一致しません");
  }
  for (const demo of expired) {
    await client.upsertDemoComment(
      demo.prNumber,
      buildExpiredComment({ headSha: demo.headSha }),
    );
  }
  await writePendingCleanup(siteDirectory, []);
  await validateSiteDirectory(siteDirectory);
}
