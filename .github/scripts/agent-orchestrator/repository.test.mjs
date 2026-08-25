import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentRepository } from './repository.mjs';

function relation(number, state = 'open') {
  return { id: `I_${number}`, number, state, repository: { name: 'widgets', owner: { login: 'octo-org' } } };
}

function pullRequest(number, state) {
  return {
    number,
    state,
    draft: true,
    base: { ref: 'main', repo: { full_name: 'octo-org/widgets' } },
    head: { ref: 'cursor/issue-7-task', repo: { full_name: 'octo-org/widgets' } },
  };
}

test('dependency、comment、label gatewayはread/write経路とdomain dataを分離する', async () => {
  const reads = new Map([
    ['/repos/octo-org/widgets/issues/7/dependencies/blocked_by', [{ id: 101, number: 3, state: 'closed', labels: [], title: 'Dependency', repository_url: 'https://api.github.com/repos/octo-org/widgets' }]],
    ['/repos/octo-org/widgets/issues/7/comments', [{ id: 5, body: '<!-- agent:dispatch:v1 issue=7 -->', user: { login: 'yuto90' } }]],
  ]);
  const writes = [];
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read(path) { return structuredClone(reads.get(path)); },
      async write(path, options) { writes.push({ path, options }); return null; },
      async graphql() { return {}; },
    },
  });

  assert.deepEqual(await repository.listIssueDependencies(7), [{ id: 101, number: 3, state: 'closed', labels: [], title: 'Dependency' }]);
  assert.deepEqual(await repository.listComments(7), [{ id: 5, body: '<!-- agent:dispatch:v1 issue=7 -->', author: 'yuto90' }]);
  await repository.postComment(7, 'body');
  await repository.removeLabel(7, 'agent-ready');

  assert.deepEqual(writes, [
    { path: '/repos/octo-org/widgets/issues/7/comments', options: { method: 'POST', body: { body: 'body' } } },
    { path: '/repos/octo-org/widgets/issues/7/labels/agent-ready', options: { method: 'DELETE' } },
  ]);
});

test('review gatewayはpositive IDを保持しmissing/duplicate IDをfail closedする', async () => {
  const review = (id) => ({ id, user: { login: 'yuto90' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-08-24T00:01:00Z', commit_id: 'abcdef' });
  const valid = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: { async read() { return [review(81)]; }, async write() {}, async graphql() {} },
  });
  assert.deepEqual(await valid.listReviews({ number: 30 }), [{
    id: 81,
    author: 'yuto90',
    state: 'changes_requested',
    submittedAt: Date.parse('2026-08-24T00:01:00Z'),
    commitId: 'abcdef',
  }]);

  for (const [name, values] of [
    ['missing', [{ ...review(81), id: undefined }]],
    ['duplicate', [review(81), review(81)]],
  ]) {
    const repository = new AgentRepository({
      config: { owner: 'octo-org', repository: 'widgets' },
      client: { async read() { return values; }, async write() {}, async graphql() {} },
    });
    await assert.rejects(() => repository.listReviews({ number: 30 }), undefined, name);
  }
});

test('GraphQL closing referenceはcross repositoryをfail closedし、全pageを返す', async () => {
  for (const nodes of [
    [{ ...relation(7), repository: { name: 'other', owner: { login: 'octo-org' } } }],
  ]) {
    const repository = new AgentRepository({
      config: { owner: 'octo-org', repository: 'widgets' },
      client: {
        async read() { return []; },
        async write() { return null; },
        async graphql() { return { repository: { pullRequest: { closingIssuesReferences: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } } } }; },
      },
    });
    await assert.rejects(() => repository.findClosingIssues(30), /repository/);
  }
});

test('GraphQL reverse relationはcursor paginationしmanaged PR判定に必要な状態を返す', async () => {
  let page = 0;
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; }, async write() { return null; },
      async graphql(_query, variables) {
        page += 1;
        assert.equal(variables.after ?? null, page === 1 ? null : 'cursor-1');
        const node = { id: `P_${page}`, number: page, state: 'OPEN', isDraft: false, baseRefName: 'main', headRefName: page === 1 ? 'human/x' : 'cursor/x', repository: { name: 'widgets', owner: { login: 'octo-org' } }, headRepository: { name: 'widgets', owner: { login: 'octo-org' } } };
        return { repository: { issue: { closedByPullRequestsReferences: { nodes: [node], pageInfo: { hasNextPage: page === 1, endCursor: page === 1 ? 'cursor-1' : null } } } } };
      },
    },
  });

  assert.deepEqual(await repository.findClosingPullRequests(7), [
    { id: 'P_1', number: 1, state: 'open', isDraft: false, baseRefName: 'main', headRefName: 'human/x', headRepository: { owner: 'octo-org', name: 'widgets' } },
    { id: 'P_2', number: 2, state: 'open', isDraft: false, baseRefName: 'main', headRefName: 'cursor/x', headRepository: { owner: 'octo-org', name: 'widgets' } },
  ]);
});

test('GraphQL reverse relationはfork headRepositoryを検証済みnonmanaged inputとして返す', async () => {
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; }, async write() { return null; },
      async graphql() {
        return { repository: { issue: { closedByPullRequestsReferences: {
          nodes: [{
            id: 'P_fork', number: 8, state: 'OPEN', isDraft: true, baseRefName: 'main', headRefName: 'cursor/fork',
            repository: { name: 'widgets', owner: { login: 'octo-org' } },
            headRepository: { name: 'widgets', owner: { login: 'fork-owner' } },
          }],
          pageInfo: { hasNextPage: false, endCursor: null },
        } } } };
      },
    },
  });

  assert.deepEqual(await repository.findClosingPullRequests(7), [{
    id: 'P_fork', number: 8, state: 'open', isDraft: true, baseRefName: 'main', headRefName: 'cursor/fork',
    headRepository: { owner: 'fork-owner', name: 'widgets' },
  }]);
});

test('GraphQL closing relationはmultipleとpaginationの全Issueを返す', async () => {
  let page = 0;
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; }, async write() { return null; },
      async graphql(_query, variables) {
        page += 1;
        assert.equal(variables.after ?? null, page === 1 ? null : 'closing-cursor-1');
        const nodes = page === 1 ? [relation(7, 'OPEN'), relation(8, 'CLOSED')] : [relation(9, 'OPEN')];
        return { repository: { pullRequest: { closingIssuesReferences: {
          nodes,
          pageInfo: { hasNextPage: page === 1, endCursor: page === 1 ? 'closing-cursor-1' : 'closing-cursor-2' },
        } } } };
      },
    },
  });

  assert.deepEqual(await repository.findClosingIssues(30), [
    { id: 'I_7', number: 7, state: 'open' },
    { id: 'I_8', number: 8, state: 'closed' },
    { id: 'I_9', number: 9, state: 'open' },
  ]);
});

test('GraphQL paginationは不整合pageInfoとcursor cycleをfetch継続前にfail closedする', async () => {
  const invalidPageInfo = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; }, async write() { return null; },
      async graphql() {
        return { repository: { pullRequest: { closingIssuesReferences: {
          nodes: [], pageInfo: { hasNextPage: true, endCursor: '' },
        } } } };
      },
    },
  });
  await assert.rejects(() => invalidPageInfo.findClosingIssues(30), /endCursor/);

  let calls = 0;
  const cyclic = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; }, async write() { return null; },
      async graphql() {
        calls += 1;
        if (calls > 2) throw new Error('unexpected fetch after cursor cycle');
        return { repository: { pullRequest: { closingIssuesReferences: {
          nodes: [], pageInfo: { hasNextPage: true, endCursor: 'same-cursor' },
        } } } };
      },
    },
  });
  await assert.rejects(() => cyclic.findClosingIssues(30), /Cursor|cursor/);
  assert.equal(calls, 2);
});

test('REST Issue/PRとGraphQL Issue/PRはunknown state enumを直接rejectする', async () => {
  const restIssue = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return { id: 130, number: 30, state: 'paused', labels: [], title: 'Task', repository_url: 'https://api.github.com/repos/octo-org/widgets' }; },
      async write() { return null; }, async graphql() { return {}; },
    },
  });
  await assert.rejects(() => restIssue.getIssue(30), /issue\.state/);

  const restPullRequest = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return { number: 30, state: 'paused', draft: true, base: { ref: 'main', repo: { full_name: 'octo-org/widgets' } }, head: { ref: 'cursor/x', repo: { full_name: 'octo-org/widgets' } } }; },
      async write() { return null; }, async graphql() { return {}; },
    },
  });
  await assert.rejects(() => restPullRequest.getPullRequest(30), /pull request\.state/);

  const graphqlIssue = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; }, async write() { return null; },
      async graphql() { return { repository: { pullRequest: { closingIssuesReferences: { nodes: [{ ...relation(7), state: 'PAUSED' }], pageInfo: { hasNextPage: false, endCursor: null } } } } }; },
    },
  });
  await assert.rejects(() => graphqlIssue.findClosingIssues(30), /state/);

  const graphqlPullRequest = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; }, async write() { return null; },
      async graphql() { return { repository: { issue: { closedByPullRequestsReferences: { nodes: [{ id: 'P_unknown', number: 8, state: 'PAUSED', isDraft: false, baseRefName: 'main', headRefName: 'cursor/x', repository: { name: 'widgets', owner: { login: 'octo-org' } }, headRepository: { name: 'widgets', owner: { login: 'octo-org' } } }], pageInfo: { hasNextPage: false, endCursor: null } } } } }; },
    },
  });
  await assert.rejects(() => graphqlPullRequest.findClosingPullRequests(7), /state/);
});

test('REST/GraphQL PullRequest stateはAPI enumを検証しMERGEDを意図どおり正規化する', async () => {
  const restRepository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return pullRequest(30, 'paused'); },
      async write() { return null; },
      async graphql() { return {}; },
    },
  });
  await assert.rejects(() => restRepository.getPullRequest(30), /pull request\.state/);

  const graphqlRepository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return []; },
      async write() { return null; },
      async graphql() {
        return {
          repository: {
            issue: {
              closedByPullRequestsReferences: {
                nodes: [{
                  id: 'P_1',
                  number: 30,
                  state: 'MERGED',
                  isDraft: false,
                  baseRefName: 'main',
                  headRefName: 'cursor/issue-7-task',
                  repository: { name: 'widgets', owner: { login: 'octo-org' } },
                  headRepository: { name: 'widgets', owner: { login: 'octo-org' } },
                }],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        };
      },
    },
  });

  assert.deepEqual(await graphqlRepository.findClosingPullRequests(7), [{
    id: 'P_1',
    number: 30,
    state: 'merged',
    isDraft: false,
    baseRefName: 'main',
    headRefName: 'cursor/issue-7-task',
    headRepository: { owner: 'octo-org', name: 'widgets' },
  }]);
});

test('current PR readはconfigured baseを厳密に確認しfork headをnonmanaged候補として返す', async () => {
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return { number: 30, state: 'open', draft: false,
        base: { ref: 'main', repo: { full_name: 'octo-org/widgets' } },
        head: { ref: 'cursor/human-fork', sha: 'abcdef', repo: { full_name: 'someone/widgets', name: 'widgets', owner: { login: 'someone' } } },
      }; }, async write() { return null; }, async graphql() { return {}; },
    },
  });
  assert.deepEqual(await repository.getCurrentPullRequest(30), {
    number: 30, state: 'open', draft: false, base: { ref: 'main' },
    head: { ref: 'cursor/human-fork', sha: 'abcdef', repository: { owner: 'someone', name: 'widgets' } },
  });
});

test('completion PR readはconfigured repositoryのmerged/base/headを公式REST shapeから検証する', async () => {
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read(path) {
        assert.equal(path, '/repos/octo-org/widgets/pulls/30');
        return {
          number: 30, state: 'closed', merged: true,
          base: { ref: 'main', repo: { full_name: 'octo-org/widgets' } },
          head: { ref: 'cursor/issue-20-task', repo: { full_name: 'octo-org/widgets', name: 'widgets', owner: { login: 'octo-org' } } },
        };
      },
      async write() { throw new Error('completion read must not write'); },
      async graphql() {},
    },
  });

  assert.deepEqual(await repository.getCompletionPullRequest(30), {
    number: 30, state: 'closed', merged: true, base: { ref: 'main' },
    head: { ref: 'cursor/issue-20-task', repository: { owner: 'octo-org', name: 'widgets' } },
  });
});

test('completion PR readはhead repositoryのfull_nameとowner/name不整合をrejectする', async () => {
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() {
        return {
          number: 30, state: 'closed', merged: true,
          base: { ref: 'main', repo: { full_name: 'octo-org/widgets' } },
          head: { ref: 'cursor/issue-20-task', repo: { full_name: 'fork/widgets', name: 'widgets', owner: { login: 'octo-org' } } },
        };
      },
      async write() {}, async graphql() {},
    },
  });

  await assert.rejects(() => repository.getCompletionPullRequest(30), /head repository/);
});
