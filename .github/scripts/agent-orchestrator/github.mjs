const API_ROOT = 'https://api.github.com';
const DEFAULT_API_VERSION = '2026-03-10';
const REQUEST_TIMEOUT_MS = 30_000;

/** GitHub REST APIが返した失敗を表します。 */
export class GitHubApiError extends Error {
  /**
   * @param {{status: number, requestId: string | null, method: string, path: string}} details
   */
  constructor({ status, requestId, method, path }) {
    super(`GitHub API request failed: ${method} ${path} returned ${status}${requestId ? ` (request id: ${requestId})` : ''}`);
    this.name = 'GitHubApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

/** @param {unknown} value @param {string} name @returns {string} */
function requireToken(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

/** @param {string} path @returns {URL} */
function apiUrl(path) {
  const url = new URL(path, API_ROOT);
  if (url.origin !== API_ROOT) {
    throw new Error('GitHub API path must stay on api.github.com');
  }
  return url;
}

/** @param {string | null} link @returns {string | null} */
function nextLink(link) {
  if (!link) return null;
  for (const part of link.split(',')) {
    const match = part.trim().match(/^<([^>]+)>;\s*rel="?next"?$/i);
    if (match) return match[1];
  }
  return null;
}

/** @param {Response} response @returns {Promise<unknown>} */
async function parseSuccess(response) {
  if (response.status === 204) return null;
  const body = await response.text();
  if (body === '') return null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export class GitHubClient {
  /**
   * @param {{readToken: string, writeToken?: string, fetchImpl?: typeof fetch, apiVersion?: string}} options
   */
  constructor({ readToken, writeToken, fetchImpl = fetch, apiVersion = DEFAULT_API_VERSION }) {
    this.readToken = requireToken(readToken, 'GITHUB_TOKEN');
    this.writeToken = writeToken ?? '';
    this.fetchImpl = fetchImpl;
    this.apiVersion = apiVersion;
  }

  /**
   * @param {string} path
   * @param {{method?: string, headers?: HeadersInit, body?: unknown, signal?: AbortSignal, paginate?: boolean}} [options]
   * @returns {Promise<unknown>}
   */
  read(path, options = {}) {
    return this.#request(path, { ...options, token: this.readToken });
  }

  /**
   * @param {string} path
   * @param {{method?: string, headers?: HeadersInit, body?: unknown, signal?: AbortSignal}} [options]
   * @returns {Promise<unknown>}
   */
  write(path, options = {}) {
    return this.#request(path, { ...options, token: requireToken(this.writeToken, 'CURSOR_AGENT_ORCHESTRATOR_PAT') });
  }

  /**
   * @param {string} query
   * @param {Record<string, unknown>} [variables]
   * @returns {Promise<unknown>}
   */
  async graphql(query, variables = {}) {
    const response = await this.#fetch('/graphql', {
      method: 'POST',
      body: { query, variables },
      token: this.readToken,
    });
    const payload = await parseSuccess(response);
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('GitHub GraphQL response must be an object');
    }
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new Error('GitHub GraphQL errors');
    }
    return payload.data;
  }

  /**
   * @param {string} path
   * @param {{method?: string, headers?: HeadersInit, body?: unknown, signal?: AbortSignal, paginate?: boolean, token: string}} options
   * @returns {Promise<unknown>}
   */
  async #request(path, options) {
    const { paginate = false, ...requestOptions } = options;
    const response = await this.#fetch(path, requestOptions);
    const firstPage = await parseSuccess(response);
    if (!paginate) return firstPage;
    if (!Array.isArray(firstPage)) {
      throw new Error('Paginated GitHub response must be an array');
    }

    const pages = [...firstPage];
    let url = nextLink(response.headers.get('link'));
    while (url) {
      const nextResponse = await this.#fetch(url, requestOptions);
      const page = await parseSuccess(nextResponse);
      if (!Array.isArray(page)) {
        throw new Error('Paginated GitHub response must be an array');
      }
      pages.push(...page);
      url = nextLink(nextResponse.headers.get('link'));
    }
    return pages;
  }

  /**
   * @param {string} path
   * @param {{method?: string, headers?: HeadersInit, body?: unknown, signal?: AbortSignal, token: string}} options
   * @returns {Promise<Response>}
   */
  async #fetch(path, { method = 'GET', headers: extraHeaders, body, signal, token }) {
    const url = apiUrl(path);
    const headers = new Headers(extraHeaders);
    headers.set('accept', 'application/vnd.github+json');
    headers.set('authorization', `Bearer ${token}`);
    headers.set('x-github-api-version', this.apiVersion);

    let serializedBody;
    if (body !== undefined) {
      serializedBody = JSON.stringify(body);
      headers.set('content-type', 'application/json');
    }
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const response = await this.fetchImpl(url.toString(), { method, headers, body: serializedBody, signal: requestSignal });
    if (!response.ok) {
      // 本文にはGitHubのエラー詳細や予期しない秘密値が含まれ得るため記録しない。
      throw new GitHubApiError({
        status: response.status,
        requestId: response.headers.get('x-github-request-id'),
        method,
        path: `${url.pathname}${url.search}`,
      });
    }
    return response;
  }
}
