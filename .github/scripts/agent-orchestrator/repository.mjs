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
    state: requireString(issue.state, `${field}.state`),
    labels: requireLabels(issue.labels, `${field}.labels`),
    title: requireString(issue.title, `${field}.title`),
  };
}

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
    state: requireString(reference.state, `${field}.state`),
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
      return { id: requirePositiveInteger(comment.id, `issue comments[${index}].id`), body: requireString(comment.body, `issue comments[${index}].body`) };
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
      state: requireString(pr.state, 'pull request.state'),
      draft: typeof pr.draft === 'boolean' ? pr.draft : (() => { throw new Error('pull request.draft must be a boolean'); })(),
      base: { ref: requireString(base.ref, 'pull request.base.ref') },
      head: { ref: requireString(head.ref, 'pull request.head.ref') },
    };
  }

  /** @param {'pullRequest' | 'issue'} type @param {number} number @param {'closingIssuesReferences' | 'closedByPullRequestsReferences'} relation */
  async #findReferences(type, number, relation) {
    const query = `query AgentRelation($owner: String!, $repository: String!, $number: Int!) {
      repository(owner: $owner, name: $repository) {
        ${type}(number: $number) {
          ${relation}(first: 10) { nodes { id number state repository { name owner { login } } } }
        }
      }
    }`;
    const data = requireObject(await this.client.graphql(query, { owner: this.owner, repository: this.repository, number: requirePositiveInteger(number, 'reference number') }), 'GraphQL data');
    const repo = requireObject(data.repository, 'GraphQL repository');
    const subject = requireObject(repo[type], `GraphQL repository.${type}`);
    const connection = requireObject(subject[relation], `GraphQL ${relation}`);
    const nodes = requireArray(connection.nodes, `GraphQL ${relation}.nodes`);
    if (nodes.length > 1) throw new Error(`GraphQL ${relation} must contain at most one relation`);
    return nodes.map((node, index) => requireGraphqlReference(node, `GraphQL ${relation}.nodes[${index}]`, this.owner, this.repository));
  }

  /** @param {number} pullRequestNumber */
  async findClosingIssues(pullRequestNumber) {
    return this.#findReferences('pullRequest', pullRequestNumber, 'closingIssuesReferences');
  }

  /** @param {number} issueNumber */
  async findClosingPullRequests(issueNumber) {
    return this.#findReferences('issue', issueNumber, 'closedByPullRequestsReferences');
  }
}
