import { evaluateDemoPolicy } from "./policy.mjs";

function labelName(label) {
  return typeof label === "string" ? label : label?.name;
}

export function createDecision(event, changedFiles) {
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    throw new Error("pull_request eventが必要です");
  }

  const prNumber = pullRequest.number ?? event.number;
  const baseRepository = pullRequest.base?.repo?.full_name ?? event.repository?.full_name;
  const headRepository = pullRequest.head?.repo?.full_name;
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new Error("PR番号が不正です");
  }
  if (!baseRepository || !headRepository) {
    throw new Error("base/head repositoryを解決できません");
  }

  const normalizedChangedFiles = [...new Set(changedFiles)].sort();
  const policy = evaluateDemoPolicy({
    body: pullRequest.body ?? "",
    labels: (pullRequest.labels ?? []).map(labelName).filter(Boolean),
    changedFiles: normalizedChangedFiles,
    baseRepository,
    headRepository,
  });

  return {
    ...policy,
    prNumber,
    baseSha: pullRequest.base?.sha,
    headSha: pullRequest.head?.sha,
    baseRepository,
    headRepository,
    changedFiles: normalizedChangedFiles,
  };
}
