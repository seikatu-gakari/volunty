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
    { id: 'P_1', number: 1, state: 'open', isDraft: false, baseRefName: 'main', headRefName: 'human/x' },
    { id: 'P_2', number: 2, state: 'open', isDraft: false, baseRefName: 'main', headRefName: 'cursor/x' },
  ]);
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
  }]);
});
