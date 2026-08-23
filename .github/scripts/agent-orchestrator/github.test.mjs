import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubApiError, GitHubClient } from './github.mjs';

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
      calls.push({
        url: String(input),
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body,
        signal: init.signal,
      });
      const response = responses.shift();
      assert.ok(response, '予定外のfetch呼び出しです');
      return response;
    },
  };
}

test('readはGITHUB_TOKEN、API version、timeoutを使いLinkを辿る', async () => {
  const fake = queueFetch([
    jsonResponse([{ id: 1 }], { headers: { link: '<https://api.github.com/things?page=2>; rel="next"' } }),
    jsonResponse([{ id: 2 }]),
  ]);
  const client = new GitHubClient({ readToken: 'read-token', writeToken: 'write-token', fetchImpl: fake.fetch });

  const result = await client.read('/things', { paginate: true });

  assert.deepEqual(result, [{ id: 1 }, { id: 2 }]);
  assert.equal(fake.calls.length, 2);
  assert.equal(fake.calls[0].url, 'https://api.github.com/things');
  assert.equal(fake.calls[1].url, 'https://api.github.com/things?page=2');
  assert.equal(fake.calls[0].headers.get('authorization'), 'Bearer read-token');
  assert.equal(fake.calls[0].headers.get('x-github-api-version'), '2026-03-10');
  assert.equal(fake.calls[0].headers.get('accept'), 'application/vnd.github+json');
  assert.ok(fake.calls[0].signal instanceof AbortSignal);
  assert.equal(fake.calls[0].signal.aborted, false);
});

test('readはGET以外のmethodまたはbodyをfetch前に拒否する', async () => {
  const fake = queueFetch([jsonResponse([])]);
  const client = new GitHubClient({ readToken: 'read-token', writeToken: 'write-token', fetchImpl: fake.fetch });

  await assert.rejects(() => client.read('/issues', { method: 'DELETE' }), /GET-only/);
  await assert.rejects(() => client.read('/issues', { body: { state: 'closed' } }), /GET-only/);
  assert.deepEqual(await client.read('/issues', { method: 'GET' }), []);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].method, 'GET');
});

test('writeはPATでJSON mutationを送る', async () => {
  const fake = queueFetch([jsonResponse({ ok: true }, { status: 201 })]);
  const client = new GitHubClient({ readToken: 'read-token', writeToken: 'write-token', fetchImpl: fake.fetch });

  const result = await client.write('/items', { method: 'POST', body: { type: 'Issue', id: 10 } });

  assert.deepEqual(result, { ok: true });
  assert.equal(fake.calls[0].url, 'https://api.github.com/items');
  assert.equal(fake.calls[0].method, 'POST');
  assert.equal(fake.calls[0].headers.get('authorization'), 'Bearer write-token');
  assert.equal(fake.calls[0].headers.get('x-github-api-version'), '2026-03-10');
  assert.equal(fake.calls[0].headers.get('content-type'), 'application/json');
  assert.equal(fake.calls[0].body, '{"type":"Issue","id":10}');
});

test('HTTP失敗はrequest IDとstatusだけを持つtyped errorにし、本文の秘密を露出しない', async () => {
  const fake = queueFetch([
    new Response('{"message":"bad","token":"response-secret"}', {
      status: 403,
      headers: { 'content-type': 'application/json', 'x-github-request-id': 'req-403' },
    }),
    new Response('upstream response-secret', {
      status: 409,
      headers: { 'content-type': 'text/plain', 'x-github-request-id': 'req-409' },
    }),
  ]);
  const client = new GitHubClient({ readToken: 'read-token', writeToken: 'write-token', fetchImpl: fake.fetch });

  for (const expected of [{ status: 403, requestId: 'req-403' }, { status: 409, requestId: 'req-409' }]) {
    await assert.rejects(
      () => client.read('/forbidden'),
      (error) => {
        assert.ok(error instanceof GitHubApiError);
        assert.equal(error.status, expected.status);
        assert.equal(error.requestId, expected.requestId);
        assert.match(error.message, new RegExp(String(expected.status)));
        assert.match(error.message, new RegExp(expected.requestId));
        assert.doesNotMatch(error.message, /response-secret|read-token|write-token/);
        return true;
      },
    );
  }
});

test('graphqlはread tokenだけを使いGraphQL errorを拒否する', async () => {
  const fake = queueFetch([
    jsonResponse({ data: { viewer: { login: 'octo' } } }),
    jsonResponse({ data: null, errors: [{ message: 'denied' }] }),
  ]);
  const client = new GitHubClient({ readToken: 'read-token', writeToken: 'write-token', fetchImpl: fake.fetch });

  assert.deepEqual(await client.graphql('query Viewer { viewer { login } }', { id: 1 }), { viewer: { login: 'octo' } });
  assert.equal(fake.calls[0].url, 'https://api.github.com/graphql');
  assert.equal(fake.calls[0].method, 'POST');
  assert.equal(fake.calls[0].headers.get('authorization'), 'Bearer read-token');
  assert.equal(fake.calls[0].body, '{"query":"query Viewer { viewer { login } }","variables":{"id":1}}');
  await assert.rejects(() => client.graphql('query Broken { viewer { login } }'), /GraphQL errors/);
});

test('graphqlはコメント付きqueryとshorthand queryだけをfetchし、mutationとsubscriptionを拒否する', async () => {
  const fake = queueFetch([
    jsonResponse({ data: { viewer: { login: 'octo' } } }),
    jsonResponse({ data: { viewer: { login: 'hubot' } } }),
  ]);
  const client = new GitHubClient({ readToken: 'read-token', writeToken: 'write-token', fetchImpl: fake.fetch });

  assert.deepEqual(await client.graphql('\n # fixed query\n query Viewer($id: ID!) { viewer { login } }', { id: 1 }), { viewer: { login: 'octo' } });
  assert.deepEqual(await client.graphql('\n # shorthand\n { viewer { login } }'), { viewer: { login: 'hubot' } });
  await assert.rejects(() => client.graphql('\n# do not mutate\n mutation Close { closeIssue(input: {}) { clientMutationId } }'), /query-only/);
  await assert.rejects(() => client.graphql(' # do not subscribe\n subscription Updates { issueComment { id } }'), /query-only/);
  assert.equal(fake.calls.length, 2);
});
