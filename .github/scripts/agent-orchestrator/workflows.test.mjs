import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const yaml = require('../../../app/node_modules/js-yaml');

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, '../../..');
const workflowsDirectory = join(repositoryRoot, '.github/workflows');
const mainPath = join(currentDirectory, 'main.mjs');

const workflowContracts = {
  'agent-start.yml': {
    command: 'start',
    on: {
      issues: { types: ['opened', 'labeled', 'closed'] },
      workflow_dispatch: null,
    },
  },
  'agent-pr-created.yml': {
    command: 'pr-created',
    on: { pull_request_target: { types: ['opened'] } },
  },
  'agent-comments.yml': {
    command: 'comments',
    on: { issue_comment: { types: ['created'] } },
  },
  'agent-ci.yml': {
    command: 'ci',
    on: {
      workflow_run: {
        workflows: ['Pull Request CI'],
        types: ['completed'],
      },
    },
  },
  'agent-review.yml': {
    command: 'review',
    on: { pull_request_review: { types: ['submitted'] } },
  },
  'agent-merge.yml': {
    command: 'merge',
    on: {
      pull_request_target: { types: ['closed'] },
      issues: { types: ['closed'] },
    },
  },
  'agent-cancel.yml': {
    command: 'cancel',
    on: { issues: { types: ['labeled'] } },
  },
};

const expectedPermissions = {
  actions: 'read',
  contents: 'read',
  issues: 'read',
  'pull-requests': 'read',
};

function parseWorkflow(name) {
  const source = readFileSync(join(workflowsDirectory, name), 'utf8');
  const parsed = yaml.load(source);
  assert.ok(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed));
  return { parsed, source };
}

function validConfig() {
  return {
    owner: 'seikatu-gakari',
    repository: 'volunty',
    projectNumber: 2,
    operator: 'yuto90',
    agentActors: ['yuto90', 'cursor[bot]'],
    labels: { ready: 'agent-ready', cancel: 'agent-cancel' },
    statuses: ['Backlog', 'In Progress', 'Human Input', 'Human Review', 'Rework', 'Blocked', 'Done', 'Cancelled'],
    ciWorkflow: 'Pull Request CI',
    ciRetryLimit: 3,
    defaultBranch: 'main',
    cursorBranchPrefix: 'cursor/',
  };
}

function projectResponses() {
  const options = validConfig().statuses.map((name, index) => ({ id: `option-${index}`, name: { raw: name } }));
  return [
    new Response(JSON.stringify({ id: 20, number: 2 }), { status: 200 }),
    new Response(JSON.stringify([{ id: 30, name: 'Status', data_type: 'single_select', options }]), { status: 200 }),
  ];
}

test('main CLI は固定 command を handler へ一対一で渡す', async () => {
  const { dispatchCommand } = await import('./main.mjs');
  const calls = [];
  const handlers = {
    handleStart: async (...args) => { calls.push(['start', ...args]); return { kind: 'preflight' }; },
    handlePrCreated: async (...args) => { calls.push(['pr-created', ...args]); return { kind: 'skip', reason: 'test' }; },
    handleComment: async (...args) => { calls.push(['comments', ...args]); return { kind: 'skip', reason: 'test' }; },
    handleCi: async (...args) => { calls.push(['ci', ...args]); return { kind: 'skip', reason: 'test' }; },
    handleReview: async (...args) => { calls.push(['review', ...args]); return { kind: 'skip', reason: 'test' }; },
    handleMerge: async (...args) => { calls.push(['merge', ...args]); return { kind: 'skip', reason: 'test' }; },
    handleCancel: async (...args) => { calls.push(['cancel', ...args]); return { kind: 'skip', reason: 'test' }; },
  };
  const event = { safe: true };

  for (const command of Object.values(workflowContracts).map((contract) => contract.command)) {
    await dispatchCommand(command, handlers, event, 'workflow_dispatch');
  }

  assert.deepEqual(calls.map(([command]) => command), ['start', 'pr-created', 'comments', 'ci', 'review', 'merge', 'cancel']);
  assert.equal(calls[0][1], event);
  assert.deepEqual(calls[0][2], { eventName: 'workflow_dispatch' });
  for (const call of calls.slice(1)) assert.deepEqual(call.slice(1), [event]);
  await assert.rejects(() => dispatchCommand('unknown', handlers, event, 'issues'), /unsupported command/u);
});

test('main CLI は一時 event/config と read-only transport で preflight を実行する', async () => {
  const { runMain } = await import('./main.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'agent-orchestrator-cli-'));
  try {
    const eventPath = join(directory, 'event.json');
    const configPath = join(directory, 'config.json');
    const summaryPath = join(directory, 'summary.md');
    writeFileSync(eventPath, JSON.stringify({
      repository: { full_name: 'seikatu-gakari/volunty', default_branch: 'main' },
    }));
    writeFileSync(configPath, JSON.stringify(validConfig()));
    const responses = projectResponses();
    const requests = [];
    const fetchImpl = async (url, init) => {
      requests.push({ url, init });
      const response = responses.shift();
      assert.ok(response, `unexpected request: ${url}`);
      return response;
    };

    const result = await runMain({
      args: ['start'],
      env: {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_TOKEN: 'read-token-value',
      },
      configPath,
      fetchImpl,
    });

    assert.deepEqual(result, { kind: 'preflight' });
    assert.equal(responses.length, 0);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(({ init }) => new Headers(init.headers).get('authorization') === 'Bearer read-token-value'));
    assert.ok(requests.every(({ init }) => init.method === 'GET'));
    const summary = readFileSync(summaryPath, 'utf8');
    assert.match(summary, /Agent Orchestrator/u);
    assert.match(summary, /事前確認/u);
    assert.match(summary, /結果/u);
    assert.doesNotMatch(summary, /read-token-value/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('main CLI は unknown command、余分な引数、malformed payload を非ゼロにする', async () => {
  const { runMain } = await import('./main.mjs');
  await assert.rejects(() => runMain({ args: ['unknown'], env: {} }), /unsupported command/u);
  await assert.rejects(() => runMain({ args: ['start', 'extra'], env: {} }), /exactly one command/u);

  const directory = mkdtempSync(join(tmpdir(), 'agent-orchestrator-invalid-'));
  try {
    const eventPath = join(directory, 'event.json');
    const summaryPath = join(directory, 'summary.md');
    writeFileSync(eventPath, '{ malformed payload secret-body');
    const result = spawnSync(process.execPath, [mainPath, 'start'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'issues',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_TOKEN: 'read-secret-do-not-print',
        CURSOR_AGENT_ORCHESTRATOR_PAT: 'write-secret-do-not-print',
      },
    });
    assert.notEqual(result.status, 0);
    const output = `${result.stdout}\n${result.stderr}\n${readFileSync(summaryPath, 'utf8')}`;
    assert.match(output, /処理に失敗/u);
    assert.doesNotMatch(output, /read-secret-do-not-print|write-secret-do-not-print|secret-body/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('main CLI は mutation だけに PAT を使い partial API failure を失敗として返す', async () => {
  const { runMain } = await import('./main.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'agent-orchestrator-partial-'));
  try {
    const eventPath = join(directory, 'event.json');
    const configPath = join(directory, 'config.json');
    const summaryPath = join(directory, 'summary.md');
    writeFileSync(eventPath, JSON.stringify({
      action: 'opened',
      issue: { number: 1 },
      repository: { full_name: 'seikatu-gakari/volunty', default_branch: 'main' },
    }));
    writeFileSync(configPath, JSON.stringify(validConfig()));
    const item = {
      id: 501,
      content_type: 'Issue',
      content: { id: 101, number: 1, state: 'open' },
      fields: [],
    };
    const responses = [
      new Response(JSON.stringify({
        id: 101,
        number: 1,
        state: 'open',
        labels: [],
        title: '安全な Issue',
        repository_url: 'https://api.github.com/repos/seikatu-gakari/volunty',
      }), { status: 200 }),
      ...projectResponses(),
      new Response('[]', { status: 200 }),
      new Response('[]', { status: 200 }),
      new Response(JSON.stringify(item), { status: 201 }),
      new Response(JSON.stringify([item]), { status: 200 }),
      new Response(JSON.stringify([item]), { status: 200 }),
      new Response(JSON.stringify({ message: 'do-not-print-api-body' }), { status: 500 }),
    ];
    const requests = [];
    const fetchImpl = async (url, init) => {
      requests.push({ url, init });
      const response = responses.shift();
      assert.ok(response, `unexpected request: ${url}`);
      return response;
    };

    await assert.rejects(() => runMain({
      args: ['start'],
      env: {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'issues',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_TOKEN: 'read-token-value',
        CURSOR_AGENT_ORCHESTRATOR_PAT: 'write-token-value',
      },
      configPath,
      fetchImpl,
    }), /GitHub API request failed/u);

    assert.equal(responses.length, 0);
    const mutations = requests.filter(({ init }) => init.method !== 'GET');
    assert.deepEqual(mutations.map(({ init }) => init.method), ['POST', 'PATCH']);
    assert.ok(requests.filter(({ init }) => init.method === 'GET')
      .every(({ init }) => new Headers(init.headers).get('authorization') === 'Bearer read-token-value'));
    assert.ok(mutations.every(({ init }) => new Headers(init.headers).get('authorization') === 'Bearer write-token-value'));

    writeFileSync(configPath, '{ malformed config');
    await assert.rejects(() => runMain({
      args: ['start'],
      env: {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'issues',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_TOKEN: 'read-token-value',
      },
      configPath,
      fetchImpl,
    }), /config must contain valid JSON/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Agent workflow は exactly seven で trigger と静的 command が一致する', () => {
  const actual = readdirSync(workflowsDirectory)
    .filter((name) => /^agent-.*\.ya?ml$/u.test(name))
    .sort();
  assert.deepEqual(actual, Object.keys(workflowContracts).sort());

  for (const [name, contract] of Object.entries(workflowContracts)) {
    const { parsed } = parseWorkflow(name);
    assert.deepEqual(parsed.on, contract.on, `${name}: trigger`);
    const jobs = Object.values(parsed.jobs ?? {});
    assert.equal(jobs.length, 1, `${name}: one thin wrapper job`);
    const runSteps = jobs[0].steps.filter((step) => Object.hasOwn(step, 'run'));
    assert.deepEqual(runSteps.map((step) => step.run), [
      `node .github/scripts/agent-orchestrator/main.mjs ${contract.command}`,
    ]);
  }
});

test('Agent workflow は最小権限、trusted checkout、Node 22、secret mapping、session concurrency を固定する', () => {
  for (const name of Object.keys(workflowContracts)) {
    const { parsed } = parseWorkflow(name);
    assert.deepEqual(parsed.permissions, expectedPermissions, `${name}: permissions`);
    assert.equal(parsed.concurrency?.['cancel-in-progress'], false, `${name}: cancel-in-progress`);
    assert.match(parsed.concurrency?.group ?? '', /^agent-orchestrator-\$\{\{ github\.repository \}\}-/u, `${name}: concurrency group`);
    assert.match(parsed.concurrency?.group ?? '', /github\.event\.(?:issue|pull_request|workflow_run)/u, `${name}: session key`);

    const [checkout, setupNode, run] = Object.values(parsed.jobs)[0].steps;
    assert.equal(checkout.uses, 'actions/checkout@v4', `${name}: checkout`);
    assert.equal(checkout.with.ref, '${{ github.event.repository.default_branch }}', `${name}: trusted default branch`);
    assert.equal(checkout.with['persist-credentials'], false, `${name}: persisted credentials`);
    assert.equal(setupNode.uses, 'actions/setup-node@v4', `${name}: setup-node`);
    assert.equal(setupNode.with['node-version'], 22, `${name}: Node.js`);
    assert.deepEqual(run.env, {
      GITHUB_TOKEN: '${{ github.token }}',
      CURSOR_AGENT_ORCHESTRATOR_PAT: '${{ secrets.CURSOR_AGENT_ORCHESTRATOR_PAT }}',
    }, `${name}: env`);
  }
});

test('Agent workflow は PR head、artifact、event本文、直接 mutation を実行しない', () => {
  for (const name of Object.keys(workflowContracts)) {
    const { parsed, source } = parseWorkflow(name);
    assert.equal(Object.hasOwn(parsed.on, 'pull_request'), false, `${name}: pull_request is forbidden`);
    assert.doesNotMatch(source, /github\.event\.[^}\n]*(?:body|title|comment|label|head_ref|head\.sha)[^}\n]*\}\}/iu, `${name}: untrusted shell interpolation`);
    assert.doesNotMatch(source, /actions\/download-artifact|github\.event\.pull_request\.head|github\.event\.workflow_run\.head_(?:sha|repository)|persist-credentials:\s*true/iu, `${name}: untrusted code/artifact`);
    const job = Object.values(parsed.jobs)[0];
    assert.ok(job.steps.every((step) => !step.uses || ['actions/checkout@v4', 'actions/setup-node@v4'].includes(step.uses)), `${name}: unexpected action`);
    assert.ok(job.steps.filter((step) => step.run).every((step) => /^node \.github\/scripts\/agent-orchestrator\/main\.mjs [a-z-]+$/u.test(step.run)), `${name}: direct mutation or shell command`);
  }
});

test('既存 Pull Request CI を保持して contract job だけを追加する', () => {
  const { parsed } = parseWorkflow('ci.yml');
  assert.equal(parsed.name, 'Pull Request CI');
  assert.deepEqual(Object.keys(parsed.jobs).sort(), ['agent-orchestrator', 'e2e', 'quality', 'rls']);
  const job = parsed.jobs['agent-orchestrator'];
  assert.equal(job['runs-on'], 'ubuntu-latest');
  const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
  const setupNode = job.steps.find((step) => step.uses === 'actions/setup-node@v4');
  const install = job.steps.find((step) => step.run === 'npm ci --no-audit');
  const testStep = job.steps.find((step) => step.run === 'node --test .github/scripts/agent-orchestrator/*.test.mjs');
  assert.ok(checkout);
  assert.equal(setupNode?.with?.['node-version'], 22);
  assert.equal(setupNode?.with?.['cache-dependency-path'], 'app/package-lock.json');
  assert.equal(install?.['working-directory'], 'app');
  assert.ok(testStep);
  assert.equal(testStep?.['working-directory'], undefined);
});
