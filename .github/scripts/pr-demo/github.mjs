import { mkdir, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";

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

  async function upsertDemoComment(
    prNumber,
    body,
    { createIfMissing = true } = {},
  ) {
    if (
      !Number.isSafeInteger(prNumber) ||
      prNumber <= 0 ||
      !body.startsWith(COMMENT_MARKER) ||
      typeof createIfMissing !== "boolean"
    ) {
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
    if (!createIfMissing) {
      return null;
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

  async function getLatestDemoStatus(sha) {
    if (!SHA_PATTERN.test(sha)) {
      throw new Error("commit status取得対象のSHAが不正です");
    }
    const statuses = await request(`/commits/${sha}/statuses?per_page=100`);
    if (!Array.isArray(statuses) || statuses.length > 100) {
      throw new Error("demo-video status APIのresponseが不正です");
    }
    const latest = statuses.find((status) => status?.context === "demo-video");
    if (!latest) {
      return undefined;
    }
    let targetUrl;
    try {
      targetUrl = new URL(latest.target_url);
    } catch {
      throw new Error("demo-video status APIのresponseが不正です");
    }
    if (
      !Number.isSafeInteger(latest.id) ||
      latest.id <= 0 ||
      !["error", "failure", "pending", "success"].includes(latest.state) ||
      targetUrl.protocol !== "https:" ||
      targetUrl.username ||
      targetUrl.password
    ) {
      throw new Error("demo-video status APIのresponseが不正です");
    }
    return {
      id: latest.id,
      context: latest.context,
      state: latest.state,
      target_url: targetUrl.toString(),
    };
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

  async function getWorkflowRunArtifacts(runId) {
    if (!Number.isSafeInteger(runId) || runId <= 0) {
      throw new Error("workflow run IDが不正です");
    }
    const artifacts = [];
    let expectedTotal;
    for (let page = 1; page <= 2; page += 1) {
      const pageSuffix = page === 1 ? "" : `&page=${page}`;
      const response = await request(
        `/actions/runs/${runId}/artifacts?per_page=100${pageSuffix}`,
      );
      if (
        !Number.isSafeInteger(response?.total_count) ||
        response.total_count < 0 ||
        response.total_count > 200 ||
        !Array.isArray(response.artifacts)
      ) {
        throw new Error("workflow run artifact APIのresponseが不正です");
      }
      expectedTotal ??= response.total_count;
      if (response.total_count !== expectedTotal) {
        throw new Error("workflow run artifact一覧が取得中に変化しました");
      }
      artifacts.push(...response.artifacts);
      if (response.artifacts.length < 100) {
        if (artifacts.length !== expectedTotal) {
          throw new Error("workflow run artifact件数がAPIのtotal_countと一致しません");
        }
        return artifacts;
      }
    }
    throw new Error("workflow run artifactが200件を超えています");
  }

  async function getLatestPullRequestCiRun(prNumber, headSha) {
    if (
      !Number.isSafeInteger(prNumber) ||
      prNumber <= 0 ||
      !SHA_PATTERN.test(headSha)
    ) {
      throw new Error("Pull Request CIの検索条件が不正です");
    }

    const runs = [];
    let expectedTotal;
    for (let page = 1; page <= 10; page += 1) {
      const pageSuffix = page === 1 ? "" : `&page=${page}`;
      const response = await request(
        `/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${headSha}&per_page=100${pageSuffix}`,
      );
      if (
        !Number.isSafeInteger(response?.total_count) ||
        response.total_count < 1 ||
        response.total_count > 1000 ||
        !Array.isArray(response.workflow_runs) ||
        response.workflow_runs.length > 100 ||
        response.workflow_runs.some(
          (run) =>
            !Number.isSafeInteger(run.id) ||
            run.id <= 0 ||
            !Number.isSafeInteger(run.run_number) ||
            run.run_number <= 0 ||
            !Number.isSafeInteger(run.run_attempt) ||
            run.run_attempt <= 0 ||
            run.event !== "pull_request" ||
            run.head_sha !== headSha ||
            !Array.isArray(run.pull_requests) ||
            run.pull_requests.some(
              (pullRequest) =>
                !Number.isSafeInteger(pullRequest.number) ||
                pullRequest.number <= 0,
            ),
        )
      ) {
        throw new Error("Pull Request CI run APIのresponseが不正です");
      }
      expectedTotal ??= response.total_count;
      if (response.total_count !== expectedTotal) {
        throw new Error("Pull Request CI run一覧が取得中に変化しました");
      }
      runs.push(...response.workflow_runs);
      if (response.workflow_runs.length < 100) {
        if (
          runs.length !== expectedTotal ||
          new Set(runs.map((run) => run.id)).size !== runs.length
        ) {
          throw new Error("Pull Request CI run件数がAPIのtotal_countと一致しません");
        }
        const candidates = runs.filter((run) =>
          run.pull_requests.some((pullRequest) => pullRequest.number === prNumber),
        );
        if (candidates.length === 0) {
          throw new Error("対象PRのPull Request CI runを確認できません");
        }
        if (
          new Set(candidates.map((run) => run.run_number)).size !==
          candidates.length
        ) {
          throw new Error("対象PRのPull Request CI run_numberが重複しています");
        }
        return candidates.reduce((latest, run) =>
          run.run_number > latest.run_number ? run : latest,
        );
      }
    }
    throw new Error("同一HEADのPull Request CI runが1000件を超えています");
  }

  async function downloadArtifactArchive(artifactId, destination, maxBytes) {
    if (
      !Number.isSafeInteger(artifactId) ||
      artifactId <= 0 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes <= 0
    ) {
      throw new Error("artifact download条件が不正です");
    }
    let url = `${API_ROOT}/repos/${repository}/actions/artifacts/${artifactId}/zip`;
    let response;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(redirectCount === 0 ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        break;
      }
      const location = response.headers.get("location");
      if (!location || redirectCount === 5) {
        throw new Error("artifact download redirectが不正です");
      }
      const redirected = new URL(location, url);
      if (
        redirected.protocol !== "https:" ||
        redirected.username ||
        redirected.password
      ) {
        throw new Error("artifact download redirect URLが不正です");
      }
      url = redirected.toString();
    }
    if (!response?.ok || !response.body) {
      throw new Error(`artifact download failed: ${response?.status ?? "no response"}`);
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader !== null) {
      if (!/^[1-9][0-9]*$/.test(contentLengthHeader)) {
        throw new Error("artifact download size headerが不正です");
      }
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > maxBytes) {
        throw new Error("artifact download sizeが上限を超えています");
      }
    }

    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    let handle;
    try {
      handle = await open(destination, "wx", 0o600);
      let downloadedBytes = 0;
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        downloadedBytes += buffer.length;
        if (downloadedBytes > maxBytes) {
          throw new Error("artifact download sizeがstream中に上限を超えました");
        }
        await handle.writeFile(buffer);
      }
      if (downloadedBytes <= 0) {
        throw new Error("artifact archiveが空です");
      }
      await handle.close();
      handle = undefined;
      return downloadedBytes;
    } catch (error) {
      await handle?.close().catch(() => {});
      await unlink(destination).catch((unlinkError) => {
        if (unlinkError.code !== "ENOENT") {
          throw unlinkError;
        }
      });
      throw error;
    }
  }

  return {
    getPullRequest(prNumber) {
      return request(`/pulls/${prNumber}`);
    },
    getPullRequestFiles,
    getLatestPullRequestCiRun,
    getWorkflowRunArtifacts,
    downloadArtifactArchive,
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
    getLatestDemoStatus,
    setDemoStatus,
    upsertDemoComment,
  };
}
