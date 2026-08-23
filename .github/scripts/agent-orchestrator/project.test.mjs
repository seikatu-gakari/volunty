import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubApiError, GitHubClient } from './github.mjs';
import { ProjectStore } from './project.mjs';

const statuses = ['Backlog', 'In Progress', 'Human Input', 'Human Review', 'Rework', 'Blocked', 'Done', 'Cancelled'];
const config = { owner: 'octo-org', projectNumber: 2, statuses };

function jsonResponse(value, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function queueFetch(responses) {
  const calls = [];
  return {
    calls,
    fetch: async (input, init = {}) => {
      calls.push({ url: String(input), method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body });
      const response = responses.shift();
      assert.ok(response, `予定外のfetch呼び出しです: ${String(input)}`);
      return response;
    },
  };
}

function project() {
  return { id: 13, number: 2, owner_url: 'https://api.github.com/orgs/octo-org' };
}

function fields(optionNames = statuses) {
  return [{
    id: 3,
    name: 'Status',
    data_type: 'single_select',
    options: optionNames.map((name, index) => ({ id: `option_${index}`, name: { raw: name, html: name } })),
  }];
}

function item(issueId, status = null) {
  return {
    id: 100 + issueId,
    content_type: 'Issue',
    content: { id: issueId, number: 6, state: 'open' },
    fields: status === null ? [] : [{
      id: 3,
      name: 'Status',
      data_type: 'single_select',
      value: { id: `option_${statuses.indexOf(status)}`, name: { raw: status, html: status } },
    }],
    created_at: '2025-08-01T18:44:51Z',
    updated_at: '2025-08-06T19:25:18Z',
    archived_at: null,
  };
}

function storeFor(responses) {
  const fake = queueFetch(responses);
  const client = new GitHubClient({ readToken: 'read-token', writeToken: 'write-token', fetchImpl: fake.fetch });
  return { fake, store: new ProjectStore({ client, config }) };
}

test('resolveProjectはRESTの動的IDとStatus option raw名を解決する', async () => {
  const { fake, store } = storeFor([jsonResponse(project()), jsonResponse(fields())]);

  assert.deepEqual(await store.resolveProject(), {
    projectId: 13,
    statusFieldId: 3,
    optionIdsByName: Object.fromEntries(statuses.map((name, index) => [name, `option_${index}`])),
  });
  assert.deepEqual(fake.calls.map((call) => call.url), [
    'https://api.github.com/orgs/octo-org/projectsV2/2',
    'https://api.github.com/orgs/octo-org/projectsV2/2/fields',
  ]);
  assert.equal(fake.calls[0].method, 'GET');
  assert.equal(fake.calls[0].headers.get('authorization'), 'Bearer read-token');
});

test('resolveProjectは不足または重複したStatus optionをfail closedする', async () => {
  for (const optionNames of [statuses.slice(0, -1), [...statuses, 'Done']]) {
    const { store } = storeFor([jsonResponse(project()), jsonResponse(fields(optionNames))]);
    await assert.rejects(() => store.resolveProject(), /Status option/);
  }
});

test('resolveProjectはStatus fieldの欠落または重複をfail closedする', async () => {
  const duplicateWithWrongType = [
    ...fields(),
    { id: 4, name: 'Status', data_type: 'text', options: [] },
  ];
  for (const fieldList of [[], duplicateWithWrongType]) {
    const { store } = storeFor([jsonResponse(project()), jsonResponse(fieldList)]);
    await assert.rejects(() => store.resolveProject(), /exactly one.*Status field/);
  }
});

test('ensureIssueItemは既存REST Issue idをPOSTせず返す', async () => {
  const existing = item(10, 'Backlog');
  const { fake, store } = storeFor([jsonResponse(project()), jsonResponse(fields()), jsonResponse([existing])]);

  assert.deepEqual(await store.ensureIssueItem(10), existing);
  assert.equal(fake.calls.length, 3);
  assert.equal(fake.calls.at(-1).method, 'GET');
  assert.match(fake.calls.at(-1).url, /\/items$/);
});

test('ensureIssueItemは422の後に再読込して実在項目だけを成功扱いにする', async () => {
  const existing = item(10, 'Backlog');
  const { fake, store } = storeFor([
    jsonResponse(project()), jsonResponse(fields()), jsonResponse([]),
    jsonResponse({ message: 'already added' }, { status: 422 }), jsonResponse([existing]),
  ]);

  assert.deepEqual(await store.ensureIssueItem(10), existing);
  assert.equal(fake.calls[3].method, 'POST');
  assert.equal(fake.calls[3].headers.get('authorization'), 'Bearer write-token');
  assert.equal(fake.calls[3].body, '{"type":"Issue","id":10}');
  assert.equal(fake.calls[4].method, 'GET');
});

test('ensureIssueItemは403と409を成功扱いにしない', async () => {
  for (const status of [403, 409]) {
    const { store } = storeFor([
      jsonResponse(project()), jsonResponse(fields()), jsonResponse([]),
      jsonResponse({ message: 'refused' }, { status, headers: { 'x-github-request-id': `req-${status}` } }),
    ]);
    await assert.rejects(() => store.ensureIssueItem(10), (error) => error instanceof GitHubApiError && error.status === status);
  }
});

test('getIssueStatusはStatus raw名が不正ならfail closedする', async () => {
  const malformed = item(10, 'Backlog');
  delete malformed.fields[0].value.name.raw;
  const { store } = storeFor([jsonResponse(project()), jsonResponse(fields()), jsonResponse([malformed])]);

  await assert.rejects(() => store.getIssueStatus(10), /value.name.raw/);
});

test('transitionIssueはmutation直前にstatusを再読込してPATCHする', async () => {
  const { fake, store } = storeFor([
    jsonResponse(project()), jsonResponse(fields()), jsonResponse([item(10, 'Backlog')]),
    jsonResponse([item(10, 'Backlog')]), jsonResponse(item(10, 'In Progress')),
  ]);

  assert.equal(await store.transitionIssue(10, 'In Progress', ['Backlog']), 'changed');
  assert.equal(fake.calls.length, 5);
  assert.equal(fake.calls[3].method, 'GET');
  assert.equal(fake.calls[4].method, 'PATCH');
  assert.equal(fake.calls[4].headers.get('authorization'), 'Bearer write-token');
  assert.equal(fake.calls[4].body, '{"fields":[{"id":3,"value":"option_1"}]}');
});

test('transitionIssueはalready target、terminal、allowedFrom不一致をPATCHしない', async () => {
  for (const scenario of [
    { current: 'In Progress', target: 'In Progress', allowedFrom: ['Backlog'], result: 'unchanged' },
    { current: 'Done', target: 'In Progress', allowedFrom: ['Done'], error: /terminal/ },
    { current: 'Backlog', target: 'In Progress', allowedFrom: ['Rework'], error: /allowedFrom/ },
  ]) {
    const { fake, store } = storeFor([
      jsonResponse(project()), jsonResponse(fields()), jsonResponse([item(10, scenario.current)]),
      jsonResponse([item(10, scenario.current)]),
    ]);
    if (scenario.error) {
      await assert.rejects(() => store.transitionIssue(10, scenario.target, scenario.allowedFrom), scenario.error);
    } else {
      assert.equal(await store.transitionIssue(10, scenario.target, scenario.allowedFrom), scenario.result);
    }
    assert.equal(fake.calls.some((call) => call.method === 'PATCH'), false);
  }
});
