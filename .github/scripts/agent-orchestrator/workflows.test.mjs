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
const designPath = join(repositoryRoot, 'docs/superpowers/specs/2026-08-23-github-projects-cursor-agent-orchestration-design.md');

const commands = ['start', 'pr-created', 'comments', 'ci', 'review', 'merge', 'cancel'];

const workflowContracts = {
  'agent-start.yml': {
    commands: ['start'],
    on: {
      issues: { types: ['opened', 'labeled', 'closed'] },
      workflow_dispatch: null,
    },
  },
  'agent-pr-created.yml': {
    commands: ['pr-created'],
    on: { pull_request_target: { types: ['opened'] } },
  },
  'agent-comments.yml': {
    commands: ['comments'],
    on: { issue_comment: { types: ['created'] } },
  },
  'agent-ci.yml': {
    commands: ['ci'],
    on: {
      workflow_run: {
        workflows: ['Pull Request CI'],
        types: ['completed'],
      },
    },
  },
  'agent-review.yml': {
    commands: ['review'],
    on: {
      workflow_dispatch: {
        inputs: {
          pull_request_number: {
            description: 'Reconcile changes requested review for Pull Request number',
            required: true,
            type: 'number',
          },
        },
      },
    },
  },
  'agent-merge.yml': {
    commands: ['merge'],
    on: {
      pull_request_target: { types: ['closed'] },
      issues: { types: ['closed'] },
    },
  },
  'agent-cancel.yml': {
    commands: ['cancel'],
    on: { issues: { types: ['labeled'] } },
  },
};

const expectedPermissions = {
  actions: 'read',
  contents: 'read',
  issues: 'read',
  'pull-requests': 'read',
};
const expectedConcurrencyGroup = 'agent-orchestrator-${{ github.repository }}';

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

function reviewDispatch(overrides = {}) {
  return {
    action: 'workflow_dispatch',
    repository: { id: 100, full_name: 'seikatu-gakari/volunty', name: 'volunty', owner: { login: 'seikatu-gakari' } },
    sender: { login: 'yuto90' },
    inputs: { pull_request_number: 42 },
    ...overrides,
  };
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

  for (const command of commands) {
    await dispatchCommand(command, handlers, event, 'workflow_dispatch');
  }

  assert.deepEqual(calls.map(([command]) => command), ['start', 'pr-created', 'comments', 'ci', 'review', 'merge', 'cancel']);
  assert.equal(calls[0][1], event);
  assert.deepEqual(calls[0][2], { eventName: 'workflow_dispatch' });
  for (const call of calls.slice(1)) assert.deepEqual(call.slice(1), [event]);
  await assert.rejects(() => dispatchCommand('unknown', handlers, event, 'issues'), /unsupported command/u);
});

test('review dispatch はworkflow_dispatchのpositive integer PR入力だけを正規化する', async () => {
  const { resolveReviewDispatch } = await import('./main.mjs');
  const config = validConfig();
  assert.deepEqual(resolveReviewDispatch(reviewDispatch(), config, 'workflow_dispatch'), {
    action: 'workflow_dispatch',
    repository: reviewDispatch().repository,
    sender: { login: 'yuto90' },
    pull_request: { number: 42 },
  });
  const withoutAction = reviewDispatch();
  delete withoutAction.action;
  assert.equal(resolveReviewDispatch(withoutAction, config, 'workflow_dispatch').pull_request.number, 42);
  assert.equal(resolveReviewDispatch(reviewDispatch({ inputs: { pull_request_number: '42' } }), config, 'workflow_dispatch').pull_request.number, 42);
  for (const value of [undefined, null, 0, -1, 1.5, '', '0', '-1', '01', '1.5', 'not-a-number', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resolveReviewDispatch(reviewDispatch({ inputs: { pull_request_number: value } }), config, 'workflow_dispatch'), /review dispatch/u, String(value));
  }
  assert.throws(() => resolveReviewDispatch(reviewDispatch(), config, 'pull_request_review'), /review dispatch/u);
  assert.throws(() => resolveReviewDispatch(reviewDispatch({ repository: { full_name: 'attacker/fork' } }), config, 'workflow_dispatch'), /review dispatch/u);
});

test('review CLI はGITHUB_EVENT_PATHだけを読みworkflow_dispatchを処理し、unauthorized actorはPATなしでskipする', async () => {
  const { runMain } = await import('./main.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'agent-review-dispatch-'));
  try {
    const eventPath = join(directory, 'workflow-dispatch.json');
    const configPath = join(directory, 'config.json');
    const summaryPath = join(directory, 'summary.md');
    writeFileSync(eventPath, JSON.stringify(reviewDispatch({ sender: { login: 'collaborator' } })));
    writeFileSync(configPath, JSON.stringify(validConfig()));
    const environment = {
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_STEP_SUMMARY: summaryPath,
      GITHUB_TOKEN: 'read-token-value',
    };
    const fetchImpl = async () => { throw new Error('unauthorized dispatch must not call API'); };
    assert.deepEqual(await runMain({ args: ['review'], env: environment, configPath, fetchImpl }), { kind: 'skip', reason: 'unauthorized-operator' });
    assert.match(readFileSync(summaryPath, 'utf8'), /安全に処理を見送りました/u);
    assert.doesNotMatch(readFileSync(summaryPath, 'utf8'), /read-token-value/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('main CLI は一時 event/config とPATのread-only Project transportで preflight を実行する', async () => {
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
        CURSOR_AGENT_ORCHESTRATOR_PAT: 'project-token-value',
      },
      configPath,
      fetchImpl,
    });

    assert.deepEqual(result, { kind: 'preflight' });
    assert.equal(responses.length, 0);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(({ init }) => new Headers(init.headers).get('authorization') === 'Bearer project-token-value'));
    assert.ok(requests.every(({ init }) => init.method === 'GET'));
    const summary = readFileSync(summaryPath, 'utf8');
    assert.match(summary, /Agent Orchestrator/u);
    assert.match(summary, /事前確認/u);
    assert.match(summary, /結果/u);
    assert.doesNotMatch(summary, /read-token-value|project-token-value/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('manual preflightはProject読み取り用PATがなければAPI呼び出し前に失敗する', async () => {
  const { runMain } = await import('./main.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'agent-orchestrator-preflight-token-'));
  try {
    const eventPath = join(directory, 'event.json');
    const configPath = join(directory, 'config.json');
    const summaryPath = join(directory, 'summary.md');
    writeFileSync(eventPath, JSON.stringify({ repository: { full_name: 'seikatu-gakari/volunty' } }));
    writeFileSync(configPath, JSON.stringify(validConfig()));
    let called = false;

    await assert.rejects(() => runMain({
      args: ['start'],
      env: {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_TOKEN: 'read-token-value',
      },
      configPath,
      fetchImpl: async () => { called = true; throw new Error('must not fetch'); },
    }), /CURSOR_AGENT_ORCHESTRATOR_PAT/u);
    assert.equal(called, false);
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

test('main CLI はRepository GETとProject GET/mutationのtokenを分離し partial API failureを失敗として返す', async () => {
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
    const repositoryReads = requests.filter(({ url, init }) => init.method === 'GET' && String(url).includes('/repos/'));
    const projectReads = requests.filter(({ url, init }) => init.method === 'GET' && String(url).includes('/projectsV2/'));
    assert.deepEqual(mutations.map(({ init }) => init.method), ['POST', 'PATCH']);
    assert.ok(repositoryReads.every(({ init }) => new Headers(init.headers).get('authorization') === 'Bearer read-token-value'));
    assert.ok(projectReads.every(({ init }) => new Headers(init.headers).get('authorization') === 'Bearer write-token-value'));
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
    assert.equal(jobs.length, 1, `${name}: thin wrapper job count`);
    const orchestratorRuns = jobs.flatMap((job) => job.steps)
      .map((step) => step.run)
      .filter((run) => typeof run === 'string' && run.startsWith('node .github/scripts/agent-orchestrator/main.mjs '))
      .sort();
    assert.deepEqual(orchestratorRuns, contract.commands.map((command) => `node .github/scripts/agent-orchestrator/main.mjs ${command}`).sort());
  }
});

test('Agent workflow は最小権限、trusted checkout、Node 22、secret mapping、repository concurrency を固定する', () => {
  const concurrencyGroups = new Set();
  for (const name of Object.keys(workflowContracts)) {
    const { parsed } = parseWorkflow(name);
    assert.deepEqual(parsed.permissions, expectedPermissions, `${name}: permissions`);
    assert.equal(parsed.concurrency?.['cancel-in-progress'], false, `${name}: cancel-in-progress`);
    assert.equal(parsed.concurrency?.group, expectedConcurrencyGroup, `${name}: repository-wide concurrency group`);
    assert.equal(parsed.concurrency?.queue, 'max', `${name}: preserve up to 100 pending runs`);
    concurrencyGroups.add(parsed.concurrency?.group);

    for (const job of Object.values(parsed.jobs)) {
      assert.equal(job.environment, 'agent-orchestrator', `${name}: protected Environment`);
      const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
      const setupNode = job.steps.find((step) => step.uses === 'actions/setup-node@v4');
      const run = job.steps.find((step) => typeof step.run === 'string' && step.run.startsWith('node .github/scripts/agent-orchestrator/main.mjs '));
      assert.equal(checkout?.with?.ref, '${{ github.event.repository.default_branch }}', `${name}: trusted default branch`);
      assert.equal(checkout?.with?.['persist-credentials'], false, `${name}: persisted credentials`);
      assert.equal(setupNode?.with?.['node-version'], 22, `${name}: Node.js`);
      assert.equal(run?.env?.GITHUB_TOKEN, '${{ github.token }}', `${name}: read token`);
      assert.equal(run?.env?.CURSOR_AGENT_ORCHESTRATOR_PAT, '${{ secrets.CURSOR_AGENT_ORCHESTRATOR_PAT }}', `${name}: PAT`);
      assert.equal(Object.hasOwn(run?.env ?? {}, 'AGENT_REVIEW_EVENT_PATH'), false);
    }
  }
  assert.deepEqual([...concurrencyGroups], [expectedConcurrencyGroup], '異なるevent入口が同じlockへ収束する');
});

test('manual review reconciliationはoperatorだけがtrusted default-branch codeで実行できる', () => {
  const { parsed, source } = parseWorkflow('agent-review.yml');
  assert.equal(parsed.name, 'Agent Orchestrator - Review Reconciliation');
  const job = parsed.jobs.orchestrate;
  assert.ok(job);
  assert.equal(job.if, "github.actor == 'yuto90' && github.triggering_actor == 'yuto90'");
  assert.equal(job.environment, 'agent-orchestrator');
  assert.match(source, /pull_request_number/u);
  assert.doesNotMatch(source, /pull_request_review|upload-artifact|download-artifact|AGENT_REVIEW_EVENT_PATH/u);
});

test('CI consumerはofficial path/event/same-repository headをsecret materialization前にguardしrepository lockを共有する', () => {
  const { parsed } = parseWorkflow('agent-ci.yml');
  const job = parsed.jobs.orchestrate;
  assert.equal(job.if, "github.event.workflow_run.event == 'pull_request_target' && github.event.workflow_run.path == '.github/workflows/ci.yml' && github.event.workflow_run.head_repository.full_name == github.repository && startsWith(github.event.workflow_run.head_branch, 'cursor/') && (github.event.workflow_run.conclusion == 'success' || github.event.workflow_run.conclusion == 'failure')");
  assert.equal(parsed.concurrency.group, expectedConcurrencyGroup);
});

test('PAT job はtrusted triggerとmain-only Environment契約を持ち、review webhookは存在しない', () => {
  for (const name of Object.keys(workflowContracts)) {
    const { parsed, source } = parseWorkflow(name);
    assert.equal(Object.hasOwn(parsed.on, 'pull_request_review'), false, `${name}: unsafe review trigger`);
    assert.doesNotMatch(source, /actions\/(?:upload|download)-artifact/u, `${name}: review artifact transport`);
    for (const job of Object.values(parsed.jobs)) {
      const hasPat = job.steps.some((step) => step.env?.CURSOR_AGENT_ORCHESTRATOR_PAT);
      if (hasPat) assert.equal(job.environment, 'agent-orchestrator');
    }
  }
  assert.match(readFileSync(designPath, 'utf8'), /GitHub Environment `agent-orchestrator`[\s\S]*main[^\n]*only/iu);
});

test('privileged Agent workflow はPR head、artifact、event本文、直接 mutationを実行しない', () => {
  for (const name of Object.keys(workflowContracts)) {
    const { parsed, source } = parseWorkflow(name);
    assert.equal(Object.hasOwn(parsed.on, 'pull_request'), false, `${name}: pull_request is forbidden`);
    assert.doesNotMatch(source, /github\.event\.[^}\n]*(?:body|title|comment|label|head_ref|head\.sha)[^}\n]*\}\}/iu, `${name}: untrusted shell interpolation`);
    assert.doesNotMatch(source, /github\.event\.pull_request\.head|github\.event\.workflow_run\.head_sha|persist-credentials:\s*true/iu, `${name}: untrusted code`);
    for (const job of Object.values(parsed.jobs)) {
      assert.ok(job.steps.every((step) => !step.uses || [
        'actions/checkout@v4', 'actions/setup-node@v4',
      ].includes(step.uses)), `${name}: unexpected action`);
      assert.ok(job.steps.filter((step) => step.run).every((step) => /^node \.github\/scripts\/agent-orchestrator\/main\.mjs [a-z-]+$/u.test(step.run)), `${name}: direct mutation or shell command`);
    }
  }
});

test('Pull Request CI はbase版workflow・read-only tokenでsame-repository PR headだけを実行しcacheを使わない', () => {
  const { parsed, source } = parseWorkflow('ci.yml');
  assert.equal(parsed.name, 'Pull Request CI');
  assert.deepEqual(parsed.on, { pull_request_target: { types: ['opened', 'synchronize', 'reopened', 'ready_for_review'], branches: ['main'] } });
  assert.deepEqual(parsed.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(parsed.jobs).sort(), ['agent-orchestrator', 'e2e', 'quality', 'rls']);
  for (const [name, candidate] of Object.entries(parsed.jobs)) {
    assert.equal(candidate.if, "github.event.pull_request.head.repo.full_name == github.repository", `${name}: same repository guard`);
    assert.equal(Object.hasOwn(candidate, 'permissions'), false, `${name}: no permission widening`);
    const checkout = candidate.steps.find((step) => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'));
    const setup = candidate.steps.find((step) => step.uses === 'actions/setup-node@v4');
    assert.equal(checkout?.uses, 'actions/checkout@v7', `${name}: protected checkout`);
    assert.equal(checkout?.with?.ref, '${{ github.event.pull_request.head.sha }}', `${name}: explicit PR head`);
    assert.equal(checkout?.with?.['persist-credentials'], false, `${name}: no persisted token`);
    assert.equal(Object.hasOwn(checkout?.with ?? {}, 'allow-unsafe-pr-checkout'), false, `${name}: checkout protection enabled`);
    assert.equal(Object.hasOwn(setup?.with ?? {}, 'cache'), false, `${name}: no cache`);
  }
  assert.doesNotMatch(source, /secrets\.|CURSOR_AGENT_ORCHESTRATOR_PAT|permissions:\s*write-all|allow-unsafe-pr-checkout/u);

  const job = parsed.jobs['agent-orchestrator'];
  assert.equal(job['runs-on'], 'ubuntu-latest');
  const setupNode = job.steps.find((step) => step.uses === 'actions/setup-node@v4');
  const install = job.steps.find((step) => step.run === 'npm ci --no-audit');
  const testStep = job.steps.find((step) => step.run === 'node --test .github/scripts/agent-orchestrator/*.test.mjs');
  assert.equal(setupNode?.with?.['node-version'], 22);
  assert.equal(install?.['working-directory'], 'app');
  assert.ok(testStep);
  assert.equal(testStep?.['working-directory'], undefined);
});
