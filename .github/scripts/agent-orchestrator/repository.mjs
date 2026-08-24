/** @param {unknown} value @param {string} field @returns {Record<string, unknown>} */
function requireObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @param {string} field @returns {string} */
function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} must be a non-empty string`);
  return value;
}

/** @param {unknown} value @param {string} field @returns {number} */
function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
  return value;
}

/** @param {unknown} value @param {string} field @returns {unknown[]} */
function requireArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

/** @param {string} value */
function encode(value) { return encodeURIComponent(value); }

/** @param {unknown} labels @param {string} field @returns {string[]} */
function requireLabels(labels, field) {
  return requireArray(labels, field).map((value, index) => requireString(requireObject(value, `${field}[${index}]`).name, `${field}[${index}].name`));
}

/** @param {Record<string, unknown>} issue @param {string} field @param {string} repositoryUrl */
function validateRepositoryUrl(issue, field, repositoryUrl) {
  if (requireString(issue.repository_url, `${field}.repository_url`) !== repositoryUrl) {
    throw new Error(`${field}.repository_url must match configured repository`);
  }
}

/** @param {unknown} value @param {string} field @param {string} repositoryUrl */
function requireRestIssue(value, field, repositoryUrl) {
  const issue = requireObject(value, field);
  validateRepositoryUrl(issue, field, repositoryUrl);
  return {
    id: requirePositiveInteger(issue.id, `${field}.id`),
    number: requirePositiveInteger(issue.number, `${field}.number`),
    state: requireIssueState(requireString(issue.state, `${field}.state`), `${field}.state`),
    labels: requireLabels(issue.labels, `${field}.labels`),
    title: requireString(issue.title, `${field}.title`),
  };
}

/** @param {string} state @param {string} field */
function requireIssueState(state, field) {
  if (!['open', 'closed'].includes(state)) throw new Error(`${field} must be open or closed`);
  return state;
}

/** @param {string} state @param {string} field */
function normalizeGraphqlIssueState(state, field) {
  if (!['OPEN', 'CLOSED'].includes(state)) throw new Error(`${field} must be OPEN or CLOSED`);
  return state.toLowerCase();
}

/** @param {string} state @param {string} field */
function normalizeGraphqlPullRequestState(state, field) {
  if (!['OPEN', 'CLOSED', 'MERGED'].includes(state)) throw new Error(`${field} must be OPEN, CLOSED, or MERGED`);
  return state.toLowerCase();
}

/** @param {string} state @param {string} field */
function requireRestPullRequestState(state, field) {
  if (!['open', 'closed'].includes(state)) throw new Error(`${field} must be open or closed`);
  return state;
}

/** @param {unknown} value @param {string} field @returns {number} */
function requireTimestamp(value, field) {
  const date = requireString(value, field);
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) throw new Error(`${field} must be an ISO date`);
  return timestamp;
}

/** @param {unknown} value @param {string} field @returns {string | null} */
function requireNullableString(value, field) {
  if (value === null) return null;
  return requireString(value, field);
}

/** @param {unknown} value @param {string} field @returns {string | null} */
function normalizeWorkflowConclusion(value, field) {
  if (value === null) return null;
  const conclusion = requireString(value, field);
  if (!['success', 'failure', 'cancelled', 'skipped', 'timed_out', 'action_required', 'neutral', 'stale'].includes(conclusion)) {
    throw new Error(`${field} must be a workflow conclusion`);
  }
  return conclusion;
}

/** @param {unknown} value @param {string} field @returns {number} */
function requireNonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

/** @param {unknown} value @param {string} field @returns {string} */
function requireWorkflowStatus(value, field) {
  const status = requireString(value, field);
  if (!['queued', 'in_progress', 'completed', 'requested', 'waiting', 'pending'].includes(status)) throw new Error(`${field} must be a workflow status`);
  return status;
}

const MAX_CI_RUN_PAGES = 1000;

/** @param {unknown} value @param {string} field @param {string} owner @param {string} repository */
function requireGraphqlReference(value, field, owner, repository) {
  const reference = requireObject(value, field);
  const relationRepository = requireObject(reference.repository, `${field}.repository`);
  if (requireString(relationRepository.name, `${field}.repository.name`) !== repository) {
    throw new Error(`${field}.repository must match configured repository`);
  }
  const relationOwner = requireObject(relationRepository.owner, `${field}.repository.owner`);
  if (requireString(relationOwner.login, `${field}.repository.owner.login`) !== owner) {
    throw new Error(`${field}.repository must match configured repository`);
  }
  return {
    id: requireString(reference.id, `${field}.id`),
    number: requirePositiveInteger(reference.number, `${field}.number`),
    state: normalizeGraphqlIssueState(requireString(reference.state, `${field}.state`), `${field}.state`),
  };
}

export class AgentRepository {
  /** @param {{client: import('./github.mjs').GitHubClient, config: {owner: string, repository: string}}} options */
  constructor({ client, config }) {
    if (!client || typeof client.read !== 'function' || typeof client.write !== 'function' || typeof client.graphql !== 'function') {
      throw new Error('AgentRepository requires a GitHubClient');
    }
    this.client = client;
    this.owner = requireString(config?.owner, 'config.owner');
    this.repository = requireString(config?.repository, 'config.repository');
    this.repositoryUrl = `https://api.github.com/repos/${this.owner}/${this.repository}`;
  }

  #issuePath(number) {
    return `/repos/${encode(this.owner)}/${encode(this.repository)}/issues/${requirePositiveInteger(number, 'issue number')}`;
  }

  /** @param {number} number */
  async getIssue(number) {
    const requestedNumber = requirePositiveInteger(number, 'issue number');
    const issue = requireRestIssue(await this.client.read(this.#issuePath(requestedNumber)), 'issue', this.repositoryUrl);
    if (issue.number !== requestedNumber) throw new Error('issue.number must match requested issue number');
    return issue;
  }

  /** @param {number} number */
  async listIssueDependencies(number) {
    const values = requireArray(await this.client.read(`${this.#issuePath(number)}/dependencies/blocked_by`, { paginate: true }), 'issue dependencies');
    return values.map((value, index) => requireRestIssue(value, `issue dependencies[${index}]`, this.repositoryUrl));
  }

  /** @param {number} number */
  async listBlockedBy(number) {
    const values = requireArray(await this.client.read(`${this.#issuePath(number)}/dependencies/blocking`, { paginate: true }), 'blocked issues');
    return values.map((value, index) => requireRestIssue(value, `blocked issues[${index}]`, this.repositoryUrl));
  }

  /** @param {number} number @param {string} label */
  async getLatestLabelActor(number, label) {
    const expectedLabel = requireString(label, 'label');
    const events = requireArray(await this.client.read(`${this.#issuePath(number)}/events`, { paginate: true }), 'issue events');
    const matching = [];
    for (const [index, value] of events.entries()) {
      const event = requireObject(value, `issue events[${index}]`);
      if (event.event !== 'labeled') continue;
      const eventLabel = requireObject(event.label, `issue events[${index}].label`);
      if (requireString(eventLabel.name, `issue events[${index}].label.name`) !== expectedLabel) continue;
      const actor = requireObject(event.actor, `issue events[${index}].actor`);
      const createdAt = requireString(event.created_at, `issue events[${index}].created_at`);
      const timestamp = Date.parse(createdAt);
      if (Number.isNaN(timestamp)) throw new Error(`issue events[${index}].created_at must be an ISO date`);
      matching.push({ login: requireString(actor.login, `issue events[${index}].actor.login`), timestamp });
    }
    if (matching.length === 0) return null;
    matching.sort((left, right) => right.timestamp - left.timestamp);
    if (matching.length > 1 && matching[0].timestamp === matching[1].timestamp && matching[0].login !== matching[1].login) {
      throw new Error('latest label event is ambiguous');
    }
    return matching[0].login;
  }

  /** @param {number} number */
  async listComments(number) {
    const values = requireArray(await this.client.read(`${this.#issuePath(number)}/comments`, { paginate: true }), 'issue comments');
    return values.map((value, index) => {
      const comment = requireObject(value, `issue comments[${index}]`);
      const user = requireObject(comment.user, `issue comments[${index}].user`);
      return { id: requirePositiveInteger(comment.id, `issue comments[${index}].id`), body: requireString(comment.body, `issue comments[${index}].body`), author: requireString(user.login, `issue comments[${index}].user.login`) };
    });
  }

  /** @param {number} number */
  async listIssueComments(number) {
    const values = requireArray(await this.client.read(`${this.#issuePath(number)}/comments`, { paginate: true }), 'issue comments');
    return values.map((value, index) => {
      const comment = requireObject(value, `issue comments[${index}]`);
      const user = requireObject(comment.user, `issue comments[${index}].user`);
      return {
        id: requirePositiveInteger(comment.id, `issue comments[${index}].id`),
        body: requireString(comment.body, `issue comments[${index}].body`),
        author: requireString(user.login, `issue comments[${index}].user.login`),
        createdAt: requireTimestamp(comment.created_at, `issue comments[${index}].created_at`),
      };
    });
  }

  /** @param {number} number @param {string} body */
  async postComment(number, body) {
    await this.client.write(`${this.#issuePath(number)}/comments`, { method: 'POST', body: { body: requireString(body, 'comment body') } });
  }

  /** @param {number} number @param {string} label */
  async removeLabel(number, label) {
    await this.client.write(`${this.#issuePath(number)}/labels/${encode(requireString(label, 'label'))}`, { method: 'DELETE' });
  }

  /** @param {number} number */
  async getPullRequest(number) {
    const requestedNumber = requirePositiveInteger(number, 'pull request number');
    const path = `/repos/${encode(this.owner)}/${encode(this.repository)}/pulls/${requestedNumber}`;
    const pr = requireObject(await this.client.read(path), 'pull request');
    const base = requireObject(pr.base, 'pull request.base');
    const head = requireObject(pr.head, 'pull request.head');
    const baseRepository = requireObject(base.repo, 'pull request.base.repo');
    const headRepository = requireObject(head.repo, 'pull request.head.repo');
    if (requireString(baseRepository.full_name, 'pull request.base.repo.full_name') !== `${this.owner}/${this.repository}`
      || requireString(headRepository.full_name, 'pull request.head.repo.full_name') !== `${this.owner}/${this.repository}`) {
      throw new Error('pull request repositories must match configured repository');
    }
    const returnedNumber = requirePositiveInteger(pr.number, 'pull request.number');
    if (returnedNumber !== requestedNumber) throw new Error('pull request.number must match requested pull request number');
    return {
      number: returnedNumber,
      state: requireRestPullRequestState(requireString(pr.state, 'pull request.state'), 'pull request.state'),
      draft: typeof pr.draft === 'boolean' ? pr.draft : (() => { throw new Error('pull request.draft must be a boolean'); })(),
      base: { ref: requireString(base.ref, 'pull request.base.ref') },
      head: { ref: requireString(head.ref, 'pull request.head.ref') },
    };
  }

  /** @param {number} number */
  async getCurrentPullRequest(number) {
    const requestedNumber = requirePositiveInteger(number, 'pull request number');
    const path = `/repos/${encode(this.owner)}/${encode(this.repository)}/pulls/${requestedNumber}`;
    const pr = requireObject(await this.client.read(path), 'pull request');
    const base = requireObject(pr.base, 'pull request.base');
    const head = requireObject(pr.head, 'pull request.head');
    const baseRepository = requireObject(base.repo, 'pull request.base.repo');
    const headRepository = requireObject(head.repo, 'pull request.head.repo');
    if (requireString(baseRepository.full_name, 'pull request.base.repo.full_name') !== `${this.owner}/${this.repository}`) {
      throw new Error('pull request repositories must match configured repository');
    }
    const headOwner = requireObject(headRepository.owner, 'pull request.head.repo.owner');
    const returnedNumber = requirePositiveInteger(pr.number, 'pull request.number');
    if (returnedNumber !== requestedNumber) throw new Error('pull request.number must match requested pull request number');
    return {
      number: returnedNumber,
      state: requireRestPullRequestState(requireString(pr.state, 'pull request.state'), 'pull request.state'),
      draft: typeof pr.draft === 'boolean' ? pr.draft : (() => { throw new Error('pull request.draft must be a boolean'); })(),
      base: { ref: requireString(base.ref, 'pull request.base.ref') },
      head: {
        ref: requireString(head.ref, 'pull request.head.ref'),
        sha: requireString(head.sha, 'pull request.head.sha'),
        repository: {
          owner: requireString(headOwner.login, 'pull request.head.repo.owner.login'),
          name: requireString(headRepository.name, 'pull request.head.repo.name'),
        },
      },
    };
  }

  /** @param {{number: number}} pullRequest @param {string} workflowName */
  async listCiRuns(pullRequest, workflowName) {
    const pr = requirePositiveInteger(pullRequest?.number, 'pull request number');
    const expectedWorkflow = requireString(workflowName, 'workflow name');
    const allRuns = [];
    const seenIds = new Set();
    let totalCount = null;
    let page = 1;
    while (totalCount === null || allRuns.length < totalCount) {
      if (totalCount !== null && page > Math.ceil(totalCount / 100)) throw new Error('workflow runs pagination exceeded expected pages');
      const path = `/repos/${encode(this.owner)}/${encode(this.repository)}/actions/runs?event=pull_request&per_page=100&page=${page}`;
      const data = requireObject(await this.client.read(path, { paginate: false }), `workflow runs page ${page}`);
      const pageTotal = requireNonNegativeInteger(data.total_count, `workflow runs page ${page}.total_count`);
      if (totalCount === null) totalCount = pageTotal;
      else if (totalCount !== pageTotal) throw new Error('workflow runs pagination total_count changed');
      if (Math.ceil(totalCount / 100) > MAX_CI_RUN_PAGES) throw new Error('workflow runs pagination exceeds maximum pages');
      const values = requireArray(data.workflow_runs, `workflow runs page ${page}.workflow_runs`);
      if (totalCount > allRuns.length && values.length === 0) throw new Error('workflow runs pagination ended prematurely');
      for (const [index, value] of values.entries()) {
        const run = requireObject(value, `workflow runs page ${page}[${index}]`);
        const repository = requireObject(run.repository, `workflow runs page ${page}[${index}].repository`);
        const repositoryId = requirePositiveInteger(repository.id, `workflow runs page ${page}[${index}].repository.id`);
        if (requireString(repository.full_name, `workflow runs page ${page}[${index}].repository.full_name`) !== `${this.owner}/${this.repository}`) throw new Error(`workflow runs page ${page}[${index}].repository must match configured repository`);
        const pullRequests = (run.pull_requests === null ? [] : requireArray(run.pull_requests, `workflow runs page ${page}[${index}].pull_requests`)).map((relation, relationIndex) => {
          const reference = requireObject(relation, `workflow runs page ${page}[${index}].pull_requests[${relationIndex}]`);
          const base = requireObject(reference.base, `workflow runs page ${page}[${index}].pull_requests[${relationIndex}].base`);
          const baseRepository = requireObject(base.repo, `workflow runs page ${page}[${index}].pull_requests[${relationIndex}].base.repo`);
          if (requirePositiveInteger(baseRepository.id, `workflow runs page ${page}[${index}].pull_requests[${relationIndex}].base.repo.id`) !== repositoryId
            || requireString(baseRepository.url, `workflow runs page ${page}[${index}].pull_requests[${relationIndex}].base.repo.url`) !== `https://api.github.com/repos/${this.owner}/${this.repository}`
            || requireString(baseRepository.name, `workflow runs page ${page}[${index}].pull_requests[${relationIndex}].base.repo.name`) !== this.repository) throw new Error(`workflow runs page ${page}[${index}].pull_requests[${relationIndex}] must match configured repository`);
          return { number: requirePositiveInteger(reference.number, `workflow runs page ${page}[${index}].pull_requests[${relationIndex}].number`) };
        });
        const mapped = {
          id: requirePositiveInteger(run.id, `workflow runs page ${page}[${index}].id`),
          name: run.name === null ? null : requireString(run.name, `workflow runs page ${page}[${index}].name`),
          status: requireWorkflowStatus(run.status, `workflow runs page ${page}[${index}].status`),
          conclusion: normalizeWorkflowConclusion(run.conclusion, `workflow runs page ${page}[${index}].conclusion`),
          headSha: requireString(run.head_sha, `workflow runs page ${page}[${index}].head_sha`),
          updatedAt: requireTimestamp(run.updated_at, `workflow runs page ${page}[${index}].updated_at`),
          url: requireString(run.html_url, `workflow runs page ${page}[${index}].html_url`),
          pullRequests,
        };
        if (seenIds.has(mapped.id)) throw new Error('workflow runs pagination contains duplicate id');
        seenIds.add(mapped.id);
        allRuns.push(mapped);
        if (allRuns.length > totalCount) throw new Error('workflow runs pagination exceeds total_count');
      }
      page += 1;
    }
    return allRuns.filter((run) => run.name === expectedWorkflow && run.pullRequests.some((reference) => reference.number === pr));
  }

  /** @param {{number: number}} pullRequest @param {string} workflowName */
  async getLatestCiRun(pullRequest, workflowName) {
    const runs = await this.listCiRuns(pullRequest, workflowName);
    return runs.sort((left, right) => right.updatedAt - left.updatedAt || right.id - left.id)[0] ?? null;
  }

  /** @param {{number: number}} pullRequest */
  async listReviews(pullRequest) {
    const number = requirePositiveInteger(pullRequest?.number, 'pull request number');
    const values = requireArray(await this.client.read(`/repos/${encode(this.owner)}/${encode(this.repository)}/pulls/${number}/reviews`, { paginate: true }), 'reviews');
    return values.map((value, index) => {
      const review = requireObject(value, `reviews[${index}]`);
      const user = requireObject(review.user, `reviews[${index}].user`);
      const state = requireString(review.state, `reviews[${index}].state`).toLowerCase();
      if (!['approved', 'changes_requested', 'commented', 'dismissed', 'pending'].includes(state)) throw new Error(`reviews[${index}].state must be a review state`);
      return {
        author: requireString(user.login, `reviews[${index}].user.login`),
        state,
        submittedAt: requireTimestamp(review.submitted_at, `reviews[${index}].submitted_at`),
        commitId: requireNullableString(review.commit_id, `reviews[${index}].commit_id`),
      };
    });
  }

  /** @param {{head: {sha: string}}} pullRequest */
  async getHeadCommit(pullRequest) {
    const sha = requireString(pullRequest?.head?.sha, 'pull request.head.sha');
    const commit = requireObject(await this.client.read(`/repos/${encode(this.owner)}/${encode(this.repository)}/commits/${encode(sha)}`), 'head commit');
    const returnedSha = requireString(commit.sha, 'head commit.sha');
    if (returnedSha !== sha) throw new Error('head commit.sha must match pull request.head.sha');
    return { sha: returnedSha };
  }

  /** @param {number} number */
  async findClosingIssues(number) {
    const query = `query AgentRelation($owner: String!, $repository: String!, $number: Int!, $after: String) {
      repository(owner: $owner, name: $repository) {
        pullRequest(number: $number) {
          closingIssuesReferences(first: 100, after: $after) { nodes { id number state repository { name owner { login } } } pageInfo { hasNextPage endCursor } }
        }
      }
    }`;
    return this.#readConnection(query, number, 'pullRequest', 'closingIssuesReferences', (node, field) => requireGraphqlReference(node, field, this.owner, this.repository));
  }

  /** @param {number} issueNumber */
  async findClosingPullRequests(issueNumber) {
    const query = `query AgentReverseRelation($owner: String!, $repository: String!, $number: Int!, $after: String) {
      repository(owner: $owner, name: $repository) {
        issue(number: $number) {
          closedByPullRequestsReferences(first: 100, after: $after) { nodes { id number state isDraft baseRefName headRefName repository { name owner { login } } headRepository { name owner { login } } } pageInfo { hasNextPage endCursor } }
        }
      }
    }`;
    return this.#readConnection(query, issueNumber, 'issue', 'closedByPullRequestsReferences', (value, field) => {
      const reference = requireObject(value, field);
      const relationRepository = requireObject(reference.repository, `${field}.repository`);
      if (requireString(relationRepository.name, `${field}.repository.name`) !== this.repository) {
        throw new Error(`${field}.repository must match configured repository`);
      }
      const relationOwner = requireObject(relationRepository.owner, `${field}.repository.owner`);
      if (requireString(relationOwner.login, `${field}.repository.owner.login`) !== this.owner) {
        throw new Error(`${field}.repository must match configured repository`);
      }
      const headRepository = requireObject(reference.headRepository, `${field}.headRepository`);
      const headName = requireString(headRepository.name, `${field}.headRepository.name`);
      const headOwner = requireObject(headRepository.owner, `${field}.headRepository.owner`);
      const headOwnerLogin = requireString(headOwner.login, `${field}.headRepository.owner.login`);
      if (typeof reference.isDraft !== 'boolean') throw new Error(`${field}.isDraft must be a boolean`);
      return { id: requireString(reference.id, `${field}.id`), number: requirePositiveInteger(reference.number, `${field}.number`), state: normalizeGraphqlPullRequestState(requireString(reference.state, `${field}.state`), `${field}.state`), isDraft: reference.isDraft, baseRefName: requireString(reference.baseRefName, `${field}.baseRefName`), headRefName: requireString(reference.headRefName, `${field}.headRefName`), headRepository: { owner: headOwnerLogin, name: headName } };
    });
  }

  async #readConnection(query, number, type, relation, mapNode) {
    const referenceNumber = requirePositiveInteger(number, 'reference number');
    const values = [];
    const seenCursors = new Set();
    let after = null;
    do {
      const data = requireObject(await this.client.graphql(query, { owner: this.owner, repository: this.repository, number: referenceNumber, after }), 'GraphQL data');
      const repo = requireObject(data.repository, 'GraphQL repository');
      const subject = requireObject(repo[type], `GraphQL repository.${type}`);
      const connection = requireObject(subject[relation], `GraphQL ${relation}`);
      const nodes = requireArray(connection.nodes, `GraphQL ${relation}.nodes`);
      values.push(...nodes.map((node, index) => mapNode(node, `GraphQL ${relation}.nodes[${index}]`)));
      const pageInfo = requireObject(connection.pageInfo, `GraphQL ${relation}.pageInfo`);
      if (typeof pageInfo.hasNextPage !== 'boolean') throw new Error(`GraphQL ${relation}.pageInfo.hasNextPage must be a boolean`);
      if (pageInfo.hasNextPage) {
        const nextCursor = requireString(pageInfo.endCursor, `GraphQL ${relation}.pageInfo.endCursor`);
        if (seenCursors.has(nextCursor)) throw new Error(`GraphQL ${relation}.pageInfo.endCursor must advance`);
        seenCursors.add(nextCursor);
        after = nextCursor;
      } else if (pageInfo.endCursor !== null && pageInfo.endCursor !== undefined && typeof pageInfo.endCursor !== 'string') {
        throw new Error(`GraphQL ${relation}.pageInfo.endCursor must be a string or null`);
      } else after = null;
    } while (after !== null);
    return values;
  }
}
