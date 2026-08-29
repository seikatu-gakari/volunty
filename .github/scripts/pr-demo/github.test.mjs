import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createGitHubClient } from "./github.mjs";

const repository = "seikatu-gakari/volunty";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("既存のgithub-actions demoコメントだけを更新する", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === "PATCH") {
      return jsonResponse({ id: 99, body: JSON.parse(options.body).body });
    }
    return jsonResponse([
      { id: 10, body: "<!-- pr-demo-comment:v1 -->", user: { login: "someone" } },
      {
        id: 99,
        body: "<!-- pr-demo-comment:v1 -->\nold",
        user: { login: "github-actions[bot]" },
      },
    ]);
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  await client.upsertDemoComment(321, "<!-- pr-demo-comment:v1 -->\nnew");

  assert.equal(calls[1].options.method, "PATCH");
  assert.match(calls[1].url, /issues\/comments\/99$/);
  assert.equal(JSON.parse(calls[1].options.body).body.endsWith("new"), true);
});

test("既存demoコメントがなければ新規作成する", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return options.method === "POST" ? jsonResponse({ id: 1 }, 201) : jsonResponse([]);
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  await client.upsertDemoComment(321, "<!-- pr-demo-comment:v1 -->\nnew");

  assert.equal(calls[1].options.method, "POST");
  assert.match(calls[1].url, /issues\/321\/comments$/);
});

test("既存demoコメントだけを更新する指定では新規コメントを作らない", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return jsonResponse([]);
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  const result = await client.upsertDemoComment(
    321,
    "<!-- pr-demo-comment:v1 -->\n対象外",
    { createIfMissing: false },
  );

  assert.equal(result, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
});

test("100件を超えるPRでも既存demoコメントをpaginationして1件だけ更新する", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === "PATCH") {
      return jsonResponse({ id: 999 });
    }
    if (url.includes("page=2")) {
      return jsonResponse([
        {
          id: 999,
          body: "<!-- pr-demo-comment:v1 -->\nold",
          user: { login: "github-actions[bot]" },
        },
      ]);
    }
    return jsonResponse(
      Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        body: "ordinary comment",
        user: { login: "someone" },
      })),
    );
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  await client.upsertDemoComment(321, "<!-- pr-demo-comment:v1 -->\nnew");

  assert.equal(calls.at(-1).options.method, "PATCH");
  assert.match(calls.at(-1).url, /issues\/comments\/999$/);
});

test("demo-video statusを指定HEADへ送る", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return jsonResponse({ state: "success" }, 201);
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  await client.setDemoStatus("b".repeat(40), {
    state: "success",
    description: "動画を公開しました",
    targetUrl: "https://example.com/demo.mp4",
  });

  assert.match(calls[0].url, new RegExp(`/statuses/${"b".repeat(40)}$`));
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    state: "success",
    context: "demo-video",
    description: "動画を公開しました",
    target_url: "https://example.com/demo.mp4",
  });
});

test("PR変更fileをpaginationしてtrusted classifierへ渡す", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("page=2")) {
      return jsonResponse([{ filename: "docs/last.md" }]);
    }
    return jsonResponse(
      Array.from({ length: 100 }, (_, index) => ({
        filename: `docs/file-${index}.md`,
      })),
    );
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  const files = await client.getPullRequestFiles(321);

  assert.equal(files.length, 101);
  assert.equal(files.at(-1), "docs/last.md");
  assert.match(calls[1], /pulls\/321\/files\?per_page=100&page=2$/);
});

test("renameされたPR fileは旧pathと新pathの両方を返す", async () => {
  const fetchImpl = async () =>
    jsonResponse([
      {
        filename: "docs/moved.md",
        previous_filename: "app/src/app/old/page.tsx",
        status: "renamed",
      },
    ]);
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  assert.deepEqual(await client.getPullRequestFiles(321), [
    "docs/moved.md",
    "app/src/app/old/page.tsx",
  ]);
});

test("workflow run artifact metadataをpaginationして取得する", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("page=2")) {
      return jsonResponse({ total_count: 101, artifacts: [{ id: 101 }] });
    }
    return jsonResponse({
      total_count: 101,
      artifacts: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })),
    });
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  const artifacts = await client.getWorkflowRunArtifacts(987);

  assert.equal(artifacts.length, 101);
  assert.match(calls[1], /actions\/runs\/987\/artifacts\?per_page=100&page=2$/);
});

test("同一HEADの対象PRからrun_numberが最新のPull Request CIを選ぶ", async () => {
  const calls = [];
  const run = (id, runNumber, prNumber) => ({
    id,
    run_number: runNumber,
    event: "pull_request",
    head_sha: "b".repeat(40),
    pull_requests: [{ number: prNumber }],
  });
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("page=2")) {
      return jsonResponse({
        total_count: 101,
        workflow_runs: [run(900, 52, 321)],
      });
    }
    return jsonResponse({
      total_count: 101,
      workflow_runs: [
        run(999, 51, 321),
        ...Array.from({ length: 99 }, (_, index) => run(index + 1, index + 1, 999)),
      ],
    });
  };
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  const latest = await client.getLatestPullRequestCiRun(321, "b".repeat(40));

  assert.equal(latest.id, 900);
  assert.equal(latest.run_number, 52);
  assert.match(calls[1], /actions\/workflows\/ci\.yml\/runs\?.*page=2$/);
});

test("artifact archiveのredirect先へtokenを送らずsizeを制限して保存する", async () => {
  const calls = [];
  const archive = Buffer.from("PK-safe-archive");
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://pipelines.actions.githubusercontent.com/archive.zip" },
      });
    }
    return new Response(archive, {
      status: 200,
      headers: { "content-length": String(archive.length) },
    });
  };
  const root = await mkdtemp(join(tmpdir(), "volunty-pr-demo-download-"));
  const destination = join(root, "artifact.zip");
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  await client.downloadArtifactArchive(123, destination, 1024);

  assert.deepEqual(await readFile(destination), archive);
  assert.match(calls[0].options.headers.Authorization, /test-token/);
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test("artifact archiveのContent-Lengthが上限超過なら書き込み前に拒否する", async () => {
  const fetchImpl = async () =>
    new Response(Buffer.from("too large"), {
      status: 200,
      headers: { "content-length": "1025" },
    });
  const root = await mkdtemp(join(tmpdir(), "volunty-pr-demo-download-limit-"));
  const client = createGitHubClient({ token: "test-token", repository, fetchImpl });

  await assert.rejects(
    client.downloadArtifactArchive(123, join(root, "artifact.zip"), 1024),
    /download size/,
  );
});
