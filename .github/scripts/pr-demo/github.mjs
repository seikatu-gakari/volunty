import { COMMENT_MARKER } from "./artifact.mjs";

const API_ROOT = "https://api.github.com";
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function createGitHubClient({ token, repository, fetchImpl = fetch }) {
  if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GitHub tokenまたはrepositoryが不正です");
  }

  async function request(path, options = {}) {
    const response = await fetchImpl(`${API_ROOT}/repos/${repository}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers ?? {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new Error(`GitHub API ${options.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  async function upsertDemoComment(prNumber, body) {
    if (!Number.isSafeInteger(prNumber) || prNumber <= 0 || !body.startsWith(COMMENT_MARKER)) {
      throw new Error("PR番号またはdemo comment bodyが不正です");
    }
    let existing;
    for (let page = 1; page <= 20; page += 1) {
      const pageSuffix = page === 1 ? "" : `&page=${page}`;
      const comments = await request(
        `/issues/${prNumber}/comments?per_page=100${pageSuffix}`,
      );
      if (!Array.isArray(comments)) {
        throw new Error("GitHub comments APIのresponseが不正です");
      }
      existing = comments.find(
        (comment) =>
          comment.user?.login === "github-actions[bot]" &&
          comment.body?.includes(COMMENT_MARKER),
      );
      if (existing || comments.length < 100) {
        break;
      }
      if (page === 20) {
        throw new Error("既存demo commentを2000件以内で確認できませんでした");
      }
    }
    if (existing) {
      return request(`/issues/comments/${existing.id}`, {
        method: "PATCH",
        body: { body },
      });
    }
    return request(`/issues/${prNumber}/comments`, {
      method: "POST",
      body: { body },
    });
  }

  async function setDemoStatus(sha, { state, description, targetUrl }) {
    if (!SHA_PATTERN.test(sha) || !["error", "failure", "pending", "success"].includes(state)) {
      throw new Error("commit statusのSHAまたはstateが不正です");
    }
    return request(`/statuses/${sha}`, {
      method: "POST",
      body: {
        state,
        context: "demo-video",
        description: description.slice(0, 140),
        ...(targetUrl ? { target_url: targetUrl } : {}),
      },
    });
  }

  async function getPullRequestFiles(prNumber) {
    if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
      throw new Error("PR番号が不正です");
    }
    const filenames = [];
    const invalidFilename = (value) =>
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > 500 ||
      /[\r\n\0]/.test(value);
    for (let page = 1; page <= 30; page += 1) {
      const pageSuffix = page === 1 ? "" : `&page=${page}`;
      const files = await request(
        `/pulls/${prNumber}/files?per_page=100${pageSuffix}`,
      );
      if (
        !Array.isArray(files) ||
        files.some(
          (file) =>
            invalidFilename(file.filename) ||
            (file.previous_filename !== undefined &&
              invalidFilename(file.previous_filename)) ||
            (file.status === "renamed" && file.previous_filename === undefined),
        )
      ) {
        throw new Error("GitHub PR files APIのresponseが不正です");
      }
      for (const file of files) {
        filenames.push(file.filename);
        if (file.previous_filename !== undefined) {
          filenames.push(file.previous_filename);
        }
      }
      if (files.length < 100) {
        return filenames;
      }
    }
    throw new Error("3000 files以上のPRは動作ビデオ判定の対象にできません");
  }

  return {
    getPullRequest(prNumber) {
      return request(`/pulls/${prNumber}`);
    },
    getPullRequestFiles,
    getWorkflowRun(runId) {
      if (!Number.isSafeInteger(runId) || runId <= 0) {
        throw new Error("workflow run IDが不正です");
      }
      return request(`/actions/runs/${runId}`);
    },
    getWorkflowRunPullRequests(runId) {
      if (!Number.isSafeInteger(runId) || runId <= 0) {
        throw new Error("workflow run IDが不正です");
      }
      return request(`/actions/runs/${runId}/pull_requests`);
    },
    setDemoStatus,
    upsertDemoComment,
  };
}
