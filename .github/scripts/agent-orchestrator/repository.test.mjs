import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentRepository } from './repository.mjs';

function relation(number, state = 'open') {
  return { id: `I_${number}`, number, state, repository: { name: 'widgets', owner: { login: 'octo-org' } } };
}

test('dependency、comment、label gatewayはread/write経路とdomain dataを分離する', async () => {
  const reads = new Map([
    ['/repos/octo-org/widgets/issues/7/dependencies/blocked_by', [{ id: 101, number: 3, state: 'closed', labels: [], title: 'Dependency', repository_url: 'https://api.github.com/repos/octo-org/widgets' }]],
    ['/repos/octo-org/widgets/issues/7/comments', [{ id: 5, body: '<!-- agent:dispatch:v1 issue=7 -->' }]],
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
  assert.deepEqual(await repository.listComments(7), [{ id: 5, body: '<!-- agent:dispatch:v1 issue=7 -->' }]);
  await repository.postComment(7, 'body');
  await repository.removeLabel(7, 'agent-ready');

  assert.deepEqual(writes, [
    { path: '/repos/octo-org/widgets/issues/7/comments', options: { method: 'POST', body: { body: 'body' } } },
    { path: '/repos/octo-org/widgets/issues/7/labels/agent-ready', options: { method: 'DELETE' } },
  ]);
});

test('GraphQL closing referenceはcross repositoryと複数関係をfail closedする', async () => {
  for (const nodes of [
    [{ ...relation(7), repository: { name: 'other', owner: { login: 'octo-org' } } }],
    [relation(7), relation(8)],
  ]) {
    const repository = new AgentRepository({
      config: { owner: 'octo-org', repository: 'widgets' },
      client: {
        async read() { return []; },
        async write() { return null; },
        async graphql() { return { repository: { pullRequest: { closingIssuesReferences: { nodes } } } }; },
      },
    });
    await assert.rejects(() => repository.findClosingIssues(30), /repository|at most one/);
  }
});
