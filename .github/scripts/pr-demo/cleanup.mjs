import {
  RETENTION_DAYS,
  buildExpiredComment,
  shouldExpireDemo,
} from "./artifact.mjs";
import {
  clearManualForkApprovalForPr,
  listPublishedDemos,
  readManualForkApprovals,
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
  const approvals = await readManualForkApprovals(siteDirectory);
  const pending = await readPendingCleanup(siteDirectory);
  const pendingByPrNumber = new Map(
    pending.map((entry) => [entry.prNumber, entry]),
  );
  const demosByPrNumber = new Map(
    demos.map((demo) => [demo.prNumber, demo]),
  );
  const candidatesByPrNumber = new Map(
    demos.map((demo) => [
      demo.prNumber,
      {
        prNumber: demo.prNumber,
        headSha: demo.headSha,
      },
    ]),
  );
  for (const approval of approvals) {
    const demo = demosByPrNumber.get(approval.prNumber);
    if (demo && demo.headSha !== approval.headSha) {
      throw new Error(
        `PR #${approval.prNumber}の公開動画とfork手動承認HEADが一致しません`,
      );
    }
    candidatesByPrNumber.set(approval.prNumber, {
      prNumber: approval.prNumber,
      headSha: approval.headSha,
    });
  }
  const removed = [];
  const candidates = [...candidatesByPrNumber.values()].sort(
    (left, right) => left.prNumber - right.prNumber,
  );
  for (const candidate of candidates) {
    const pullRequest = await client.getPullRequest(candidate.prNumber);
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

    const hadDemo = demosByPrNumber.has(candidate.prNumber);
    const demoRemoved = await removeDemoFromSite(
      siteDirectory,
      candidate.prNumber,
    );
    const approvalRemoved = await clearManualForkApprovalForPr(
      siteDirectory,
      candidate.prNumber,
    );
    if (demoRemoved || approvalRemoved) {
      removed.push(candidate.prNumber);
    }
    if (hadDemo) {
      const existing = pendingByPrNumber.get(candidate.prNumber);
      if (existing && existing.headSha !== candidate.headSha) {
        throw new Error(
          `PR #${candidate.prNumber}のcleanup再試行HEADが一致しません`,
        );
      }
      pendingByPrNumber.set(candidate.prNumber, candidate);
    }
  }

  const expired = await writePendingCleanup(
    siteDirectory,
    [...pendingByPrNumber.values()],
  );
  await validateSiteDirectory(siteDirectory);
  return {
    removed,
    expired,
    requiresDeployment: removed.length > 0 || expired.length > 0,
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
