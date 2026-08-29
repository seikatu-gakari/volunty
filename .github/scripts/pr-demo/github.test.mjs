import assert from "node:assert/strict";
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
