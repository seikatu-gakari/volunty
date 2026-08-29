import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { main } from "./finalize-publish.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);

test("handoff fileがなくてもtrusted eventから最新HEADを解決してfailureにする", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-finalize-"));
  const eventPath = join(directory, "event.json");
  await writeFile(
    eventPath,
    JSON.stringify({
      repository: { full_name: repository },
      workflow_run: {
        id: 987,
        run_attempt: 1,
        name: "Pull Request CI",
        event: "pull_request",
        conclusion: "success",
        head_sha: headSha,
        head_repository: { full_name: repository },
        html_url: `https://github.com/${repository}/actions/runs/987`,
        pull_requests: [{ number: 321, head: { sha: headSha } }],
      },
    }),
  );
  const calls = [];

  await assert.rejects(
    main({
      resultPath: join(directory, "missing-result.json"),
      eventPath,
      token: "test-token",
      repository,
      githubClient: {
        async getLatestPullRequestCiRun() {
          return { id: 987, run_attempt: 1 };
        },
        async getPullRequest() {
          return { head: { sha: headSha } };
        },
        async upsertDemoComment(prNumber, body) {
          calls.push({ type: "comment", prNumber, body });
        },
        async setDemoStatus(sha, status) {
          calls.push({ type: "status", sha, status });
        },
      },
    }),
    /demo-videoをfailure/,
  );

  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.match(calls[0].body, /handoff/);
  assert.equal(calls[1].sha, headSha);
  assert.equal(calls[1].status.state, "failure");
});
