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
    commands: ['ci', 'review'],
    on: {
      workflow_run: {
        workflows: ['Pull Request CI', 'Agent Review Signal'],
        types: ['completed'],
      },
    },
  },
  'agent-review.yml': {
    commands: [],
    on: { pull_request_review: { types: ['submitted'] } },
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

function workflowRelation({ number = 42, headSha = 'abcdef1234567890' } = {}) {
  const repository = { id: 100, url: 'https://api.github.com/repos/seikatu-gakari/volunty', name: 'volunty' };
  return {
    id: 200,
    number,
    url: `https://api.github.com/repos/seikatu-gakari/volunty/pulls/${number}`,
    base: { ref: 'main', sha: 'base-sha', repo: repository },
    head: { ref: 'cursor/issue-1-safe', sha: headSha, repo: repository },
  };
}

function reviewWorkflowRun(overrides = {}) {
  return {
    action: 'completed',
    repository: { id: 100, full_name: 'seikatu-gakari/volunty', name: 'volunty', owner: { login: 'seikatu-gakari' } },
    workflow_run: {
      id: 900,
      name: 'Agent Review Signal',
      event: 'pull_request_review',
      status: 'completed',
      conclusion: 'success',
      head_sha: 'abcdef1234567890',
      repository: { id: 100, full_name: 'seikatu-gakari/volunty' },
      pull_requests: [workflowRelation()],
      ...overrides,
    },
  };
}

function reviewSignal(overrides = {}) {
  return {
    action: 'submitted',
    repository: { id: 100, full_name: 'seikatu-gakari/volunty', name: 'volunty', owner: { login: 'seikatu-gakari' } },
    pull_request: {
      number: 42,
      base: { ref: 'main', sha: 'base-sha', repo: { id: 100, full_name: 'seikatu-gakari/volunty' } },
      head: { ref: 'cursor/issue-1-safe', sha: 'abcdef1234567890', repo: { id: 100, full_name: 'seikatu-gakari/volunty' } },
    },
    review: {
      id: 700,
      user: { login: 'yuto90' },
      state: 'changes_requested',
      commit_id: 'abcdef1234567890',
      submitted_at: '2026-08-25T00:00:00Z',
    },
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

test('review signal は trusted workflow_run とPR/head/review evidenceが一致する場合だけ受理する', async () => {
  const { resolveReviewSignal } = await import('./main.mjs');
  const config = validConfig();
  const outer = reviewWorkflowRun();
  const signal = reviewSignal();

  assert.equal(resolveReviewSignal(outer, signal, config, 'workflow_run'), signal);

  const invalidPairs = [
    [reviewWorkflowRun({ name: 'Other Workflow' }), signal],
    [reviewWorkflowRun({ event: 'pull_request' }), signal],
    [reviewWorkflowRun({ status: 'in_progress' }), signal],
    [reviewWorkflowRun({ conclusion: 'failure' }), signal],
    [reviewWorkflowRun({ pull_requests: [workflowRelation({ headSha: 'other-sha' })] }), signal],
    [reviewWorkflowRun({ pull_requests: [] }), signal],
    [reviewWorkflowRun({ pull_requests: [workflowRelation(), workflowRelation({ number: 43 })] }), signal],
    [outer, reviewSignal({ action: 'edited' })],
    [outer, reviewSignal({ repository: { full_name: 'attacker/fork' } })],
    [outer, reviewSignal({ pull_request: { ...signal.pull_request, number: 43 } })],
    [outer, reviewSignal({ pull_request: { ...signal.pull_request, head: { ...signal.pull_request.head, sha: 'other-sha' } } })],
    [outer, reviewSignal({ review: { ...signal.review, id: 0 } })],
    [outer, reviewSignal({ review: { ...signal.review, commit_id: 'other-sha' } })],
  ];
  for (const [workflowEvent, artifactEvent] of invalidPairs) {
    assert.throws(() => resolveReviewSignal(workflowEvent, artifactEvent, config, 'workflow_run'), /review signal/u);
  }
  assert.throws(() => resolveReviewSignal(outer, signal, config, 'pull_request_review'), /review signal/u);
});

test('review CLI は固定artifact pathを読み、検証済みsignalだけをauthoritative handlerへ渡す', async () => {
  const { runMain } = await import('./main.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'agent-review-consumer-'));
  try {
    const eventPath = join(directory, 'workflow-run.json');
    const reviewEventPath = join(directory, 'review-event.json');
    const configPath = join(directory, 'config.json');
    const summaryPath = join(directory, 'summary.md');
    writeFileSync(eventPath, JSON.stringify(reviewWorkflowRun()));
    writeFileSync(reviewEventPath, JSON.stringify(reviewSignal()));
    writeFileSync(configPath, JSON.stringify(validConfig()));
    const received = [];
    const handlersFactory = () => ({
      handleReview: async (event) => { received.push(event); return { kind: 'skip', reason: 'test' }; },
    });
    const environment = {
      GITHUB_EVENT_PATH: eventPath,
      AGENT_REVIEW_EVENT_PATH: reviewEventPath,
      GITHUB_EVENT_NAME: 'workflow_run',
      GITHUB_STEP_SUMMARY: summaryPath,
      GITHUB_TOKEN: 'read-token-value',
      CURSOR_AGENT_ORCHESTRATOR_PAT: 'write-token-value',
    };

    assert.deepEqual(await runMain({ args: ['review'], env: environment, configPath, handlersFactory }), { kind: 'skip', reason: 'test' });
    assert.deepEqual(received, [reviewSignal()]);

    writeFileSync(reviewEventPath, JSON.stringify(reviewSignal({ review: { ...reviewSignal().review, commit_id: 'fabricated' } })));
    await assert.rejects(() => runMain({ args: ['review'], env: environment, configPath, handlersFactory }), /review signal/u);
    assert.equal(received.length, 1);
    await assert.rejects(() => runMain({
      args: ['review'], env: { ...environment, AGENT_REVIEW_EVENT_PATH: undefined }, configPath, handlersFactory,
    }), /AGENT_REVIEW_EVENT_PATH/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
    assert.equal(jobs.length, name === 'agent-ci.yml' ? 2 : 1, `${name}: thin wrapper job count`);
    const orchestratorRuns = jobs.flatMap((job) => job.steps)
      .map((step) => step.run)
      .filter((run) => typeof run === 'string' && run.startsWith('node .github/scripts/agent-orchestrator/main.mjs '))
      .sort();
    assert.deepEqual(orchestratorRuns, contract.commands.map((command) => `node .github/scripts/agent-orchestrator/main.mjs ${command}`).sort());
  }
});

test('Agent workflow は最小権限、trusted checkout、Node 22、secret mapping、session concurrency を固定する', () => {
  for (const name of Object.keys(workflowContracts)) {
    const { parsed } = parseWorkflow(name);
    assert.deepEqual(parsed.permissions, name === 'agent-review.yml' ? {} : expectedPermissions, `${name}: permissions`);
    assert.equal(parsed.concurrency?.['cancel-in-progress'], false, `${name}: cancel-in-progress`);
    assert.match(parsed.concurrency?.group ?? '', /^agent-orchestrator-\$\{\{ github\.repository \}\}-/u, `${name}: concurrency group`);
    assert.match(parsed.concurrency?.group ?? '', /github\.event\.(?:issue|pull_request|workflow_run)/u, `${name}: session key`);
    if (name === 'agent-review.yml') continue;

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
      if (run?.run.endsWith(' review')) {
        assert.equal(run.env.AGENT_REVIEW_EVENT_PATH, '${{ runner.temp }}/agent-review-signal/review-event.json');
      } else {
        assert.equal(Object.hasOwn(run?.env ?? {}, 'AGENT_REVIEW_EVENT_PATH'), false);
      }
    }
  }
});

test('review signal job は権限・secret・checkoutを持たず固定artifactだけを保存する', () => {
  const { parsed, source } = parseWorkflow('agent-review.yml');
  assert.equal(parsed.name, 'Agent Review Signal');
  const job = parsed.jobs.capture;
  assert.ok(job);
  assert.equal(Object.hasOwn(job, 'environment'), false);
  assert.doesNotMatch(source, /CURSOR_AGENT_ORCHESTRATOR_PAT|GITHUB_TOKEN|secrets\.|actions\/checkout|actions\/setup-node/u);
  const copy = job.steps.find((step) => typeof step.run === 'string');
  assert.match(copy.run, /\$GITHUB_EVENT_PATH/u);
  assert.match(copy.run, /\$RUNNER_TEMP\/agent-review-signal\/review-event\.json/u);
  assert.doesNotMatch(copy.run, /\$\{\{\s*github\.event/u);
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.with.name, 'agent-review-signal');
  assert.equal(upload.with.path, '${{ runner.temp }}/agent-review-signal/review-event.json');
  assert.equal(upload.with['retention-days'], 1);
});

test('review consumer はsuccessful signal workflow_runだけをartifactとして読み、実行しない', () => {
  const { parsed, source } = parseWorkflow('agent-ci.yml');
  const review = parsed.jobs.review;
  assert.equal(review.if, "github.event.workflow_run.name == 'Agent Review Signal' && github.event.workflow_run.event == 'pull_request_review' && github.event.workflow_run.conclusion == 'success'");
  const download = review.steps.find((step) => step.uses === 'actions/download-artifact@v4');
  assert.equal(download.with.name, 'agent-review-signal');
  assert.equal(download.with.path, '${{ runner.temp }}/agent-review-signal');
  assert.equal(download.with['github-token'], '${{ github.token }}');
  assert.equal(download.with.repository, '${{ github.repository }}');
  assert.equal(download.with['run-id'], '${{ github.event.workflow_run.id }}');
  assert.doesNotMatch(source, /chmod|source\s|bash\s+\$|node\s+\$\{\{\s*runner\.temp/u);
});

test('PAT job はtrusted triggerとmain-only Environment契約を持ち、direct review workflowには存在しない', () => {
  for (const name of Object.keys(workflowContracts)) {
    const { parsed, source } = parseWorkflow(name);
    if (Object.hasOwn(parsed.on, 'pull_request_review')) {
      assert.doesNotMatch(source, /CURSOR_AGENT_ORCHESTRATOR_PAT|secrets\.|environment:/u);
    }
    for (const job of Object.values(parsed.jobs)) {
      const hasPat = job.steps.some((step) => step.env?.CURSOR_AGENT_ORCHESTRATOR_PAT);
      if (hasPat) assert.equal(job.environment, 'agent-orchestrator');
    }
  }
  assert.match(readFileSync(designPath, 'utf8'), /GitHub Environment `agent-orchestrator`[\s\S]*main[^\n]*only/iu);
});

test('Agent workflow は PR head、artifact、event本文、直接 mutation を実行しない', () => {
  for (const name of Object.keys(workflowContracts)) {
    const { parsed, source } = parseWorkflow(name);
    assert.equal(Object.hasOwn(parsed.on, 'pull_request'), false, `${name}: pull_request is forbidden`);
    assert.doesNotMatch(source, /github\.event\.[^}\n]*(?:body|title|comment|label|head_ref|head\.sha)[^}\n]*\}\}/iu, `${name}: untrusted shell interpolation`);
    assert.doesNotMatch(source, /github\.event\.pull_request\.head|github\.event\.workflow_run\.head_(?:sha|repository)|persist-credentials:\s*true/iu, `${name}: untrusted code`);
    for (const job of Object.values(parsed.jobs)) {
      assert.ok(job.steps.every((step) => !step.uses || [
        'actions/checkout@v4', 'actions/setup-node@v4', 'actions/upload-artifact@v4', 'actions/download-artifact@v4',
      ].includes(step.uses)), `${name}: unexpected action`);
      assert.ok(job.steps.filter((step) => step.run).every((step) => (
        /^node \.github\/scripts\/agent-orchestrator\/main\.mjs [a-z-]+$/u.test(step.run)
        || (name === 'agent-review.yml' && step.run.includes('$GITHUB_EVENT_PATH'))
      )), `${name}: direct mutation or shell command`);
    }
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
