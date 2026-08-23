import { GitHubApiError } from './github.mjs';

const terminalStatuses = new Set(['Done', 'Cancelled']);

/** @param {unknown} value @param {string} field @returns {Record<string, unknown>} */
function requireObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @param {string} field @returns {number} */
function requireId(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

/** @param {unknown} value @param {string} field @returns {string} */
function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

/** @param {unknown} value @param {string} field @returns {unknown[]} */
function requireArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

/** @param {unknown} value @param {number} issueId @returns {Record<string, unknown>} */
function requireProjectItem(value, issueId) {
  const item = requireObject(value, 'project item');
  requireId(item.id, 'project item.id');
  if (item.content_type !== 'Issue') throw new Error('project item.content_type must be Issue');
  const content = requireObject(item.content, 'project item.content');
  if (requireId(content.id, 'project item.content.id') !== issueId) {
    throw new Error('project item must match the requested REST Issue id');
  }
  requireArray(item.fields, 'project item.fields');
  return item;
}

/** @param {unknown} value @param {number} issueId @returns {boolean} */
function isIssueItemFor(value, issueId) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = /** @type {Record<string, unknown>} */ (value);
  if (item.content_type !== 'Issue' || item.content === null || typeof item.content !== 'object' || Array.isArray(item.content)) return false;
  return /** @type {Record<string, unknown>} */ (item.content).id === issueId;
}

export class ProjectStore {
  /** @param {{client: import('./github.mjs').GitHubClient, config: import('./config.mjs').AgentConfig}} options */
  constructor({ client, config }) {
    this.client = client;
    this.config = config;
    this.resolvedProject = null;
    if (!Array.isArray(config.statuses) || config.statuses.length === 0 || new Set(config.statuses).size !== config.statuses.length) {
      throw new Error('config.statuses must contain unique status names');
    }
  }

  #basePath() {
    return `/orgs/${encodeURIComponent(this.config.owner)}/projectsV2/${this.config.projectNumber}`;
  }

  /** @returns {Promise<{projectId: number, statusFieldId: number, optionIdsByName: Record<string, string>}>} */
  async resolveProject() {
    if (this.resolvedProject) return this.resolvedProject;
    this.resolvedProject = this.#resolveProject();
    return this.resolvedProject;
  }

  async #resolveProject() {
    const project = requireObject(await this.client.read(this.#basePath()), 'project');
    const projectId = requireId(project.id, 'project.id');
    if (requireId(project.number, 'project.number') !== this.config.projectNumber) {
      throw new Error('project.number must match config.projectNumber');
    }
    const fields = requireArray(await this.client.read(`${this.#basePath()}/fields`, { paginate: true }), 'project fields');
    const statusFields = fields.filter((field) => (
      field !== null && typeof field === 'object' && !Array.isArray(field)
      && /** @type {Record<string, unknown>} */ (field).name === 'Status'
    ));
    if (statusFields.length !== 1) throw new Error('Project must contain exactly one single_select Status field');

    const statusField = requireObject(statusFields[0], 'Status field');
    if (statusField.data_type !== 'single_select') {
      throw new Error('Project must contain exactly one single_select Status field');
    }
    const statusFieldId = requireId(statusField.id, 'Status field.id');
    const options = requireArray(statusField.options, 'Status field.options');
    const optionIdsByName = {};
    const optionIds = new Set();
    for (const [index, optionValue] of options.entries()) {
      const option = requireObject(optionValue, `Status option[${index}]`);
      const optionId = requireString(option.id, `Status option[${index}].id`);
      const optionName = requireObject(option.name, `Status option[${index}].name`);
      const name = requireString(optionName.raw, `Status option[${index}].name.raw`);
      if (Object.hasOwn(optionIdsByName, name)) throw new Error(`Status option is duplicated: ${name}`);
      if (optionIds.has(optionId)) throw new Error(`Status option id is duplicated: ${optionId}`);
      optionIdsByName[name] = optionId;
      optionIds.add(optionId);
    }
    for (const name of this.config.statuses) {
      if (!Object.hasOwn(optionIdsByName, name)) throw new Error(`Status option is missing: ${name}`);
    }
    return { projectId, statusFieldId, optionIdsByName };
  }

  /**
   * @param {Record<string, unknown>} item
   * @param {{statusFieldId: number, optionIdsByName: Record<string, string>}} resolvedProject
   * @returns {string | null}
   */
  #statusForItem(item, { statusFieldId, optionIdsByName }) {
    const fields = requireArray(item.fields, 'project item.fields');
    const statusValues = fields.filter((field) => (
      field !== null && typeof field === 'object' && !Array.isArray(field)
      && /** @type {Record<string, unknown>} */ (field).id === statusFieldId
    ));
    if (statusValues.length === 0) return null;
    if (statusValues.length !== 1) throw new Error('project item has duplicate Status fields');
    const statusField = requireObject(statusValues[0], 'project item Status field');
    if (statusField.name !== 'Status' || statusField.data_type !== 'single_select') {
      throw new Error('project item Status field discriminator is invalid');
    }
    if (statusField.value === null || statusField.value === undefined) return null;
    const value = requireObject(statusField.value, 'project item Status field.value');
    const valueId = requireString(value.id, 'project item Status field.value.id');
    const name = requireObject(value.name, 'project item Status field.value.name');
    const status = requireString(name.raw, 'project item Status field.value.name.raw');
    if (!Object.hasOwn(optionIdsByName, status)) throw new Error(`project item Status is unknown: ${status}`);
    if (optionIdsByName[status] !== valueId) {
      throw new Error('project item Status field.value.id must match name.raw');
    }
    return status;
  }

  /**
   * @param {number} issueId
   * @returns {Promise<{itemId: number | null, status: string | null}>}
   */
  async #readIssueState(issueId) {
    const resolvedProject = await this.resolveProject();
    const item = await this.#findIssueItem(issueId);
    if (!item) return { itemId: null, status: null };
    return {
      itemId: requireId(item.id, 'project item.id'),
      status: this.#statusForItem(item, resolvedProject),
    };
  }

  /** @param {number} issueId @returns {Promise<Record<string, unknown> | null>} */
  async #findIssueItem(issueId) {
    requireId(issueId, 'issueId');
    const items = requireArray(await this.client.read(`${this.#basePath()}/items`, { paginate: true }), 'project items');
    const matches = items.filter((item) => isIssueItemFor(item, issueId));
    if (matches.length > 1) throw new Error(`Project contains duplicate items for REST Issue id ${issueId}`);
    return matches.length === 0 ? null : requireProjectItem(matches[0], issueId);
  }

  /** @param {number} issueId @returns {Promise<Record<string, unknown>>} */
  async ensureIssueItem(issueId) {
    await this.resolveProject();
    const existing = await this.#findIssueItem(issueId);
    if (existing) return existing;
    try {
      const added = await this.client.write(`${this.#basePath()}/items`, { method: 'POST', body: { type: 'Issue', id: issueId } });
      return requireProjectItem(added, issueId);
    } catch (error) {
      if (!(error instanceof GitHubApiError) || error.status !== 422) throw error;
      const recovered = await this.#findIssueItem(issueId);
      if (recovered) return recovered;
      throw error;
    }
  }

  /** @param {number} issueId @returns {Promise<string | null>} */
  async getIssueStatus(issueId) {
    return (await this.#readIssueState(issueId)).status;
  }

  /**
   * @param {number} issueId
   * @param {string} target
   * @param {(string | null)[]} allowedFrom
   * @returns {Promise<'changed' | 'unchanged'>}
   */
  async transitionIssue(issueId, target, allowedFrom) {
    const { statusFieldId, optionIdsByName } = await this.resolveProject();
    if (!Object.hasOwn(optionIdsByName, target)) throw new Error(`Unknown target Status: ${target}`);
    if (!Array.isArray(allowedFrom) || allowedFrom.some((status) => (
      status !== null && (typeof status !== 'string' || !Object.hasOwn(optionIdsByName, status))
    ))) {
      throw new Error('allowedFrom must contain only configured Status names or null');
    }

    await this.ensureIssueItem(issueId);
    // PATCH直前にitem IDとStatusを同じ一覧結果から読む。
    const latest = await this.#readIssueState(issueId);
    if (latest.itemId === null) throw new Error('Project item disappeared before transition');
    const current = latest.status;
    if (current === target) return 'unchanged';
    if (terminalStatuses.has(current)) throw new Error(`Cannot transition terminal Status: ${current}`);
    if (!allowedFrom.includes(current)) {
      throw new Error(`Current Status is not in allowedFrom: ${current ?? 'unset'}`);
    }

    await this.client.write(`${this.#basePath()}/items/${latest.itemId}`, {
      method: 'PATCH',
      body: { fields: [{ id: statusFieldId, value: optionIdsByName[target] }] },
    });
    return 'changed';
  }
}
