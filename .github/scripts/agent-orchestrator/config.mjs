import { readFileSync } from 'node:fs';

/**
 * @typedef {object} AgentConfig
 * @property {string} owner
 * @property {string} repository
 * @property {number} projectNumber
 * @property {string} operator
 * @property {string[]} agentActors
 * @property {{ready: string, cancel: string}} labels
 * @property {string[]} statuses
 * @property {string} ciWorkflow
 * @property {number} ciRetryLimit
 * @property {string} defaultBranch
 * @property {string} cursorBranchPrefix
 */

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {Record<string, unknown>}
 */
function requireObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }

  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {{length?: number, unique?: boolean}} [options]
 * @returns {string[]}
 */
function requireStringArray(value, field, options = {}) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  if (options.length !== undefined && value.length !== options.length) {
    throw new Error(`${field} must contain exactly ${options.length} entries`);
  }
  if (value.length === 0) {
    throw new Error(`${field} must not be empty`);
  }

  const strings = value.map((entry, index) => requireString(entry, `${field}[${index}]`));
  if (options.unique && new Set(strings).size !== strings.length) {
    throw new Error(`${field} must contain unique entries`);
  }

  return strings;
}

/**
 * @param {string} path
 * @returns {AgentConfig}
 */
export function loadConfig(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('config must contain valid JSON');
    }
    throw error;
  }

  const config = requireObject(parsed, 'config');
  const labels = requireObject(config.labels, 'labels');

  return {
    owner: requireString(config.owner, 'owner'),
    repository: requireString(config.repository, 'repository'),
    projectNumber: requirePositiveInteger(config.projectNumber, 'projectNumber'),
    operator: requireString(config.operator, 'operator'),
    agentActors: requireStringArray(config.agentActors, 'agentActors', { unique: true }),
    labels: {
      ready: requireString(labels.ready, 'labels.ready'),
      cancel: requireString(labels.cancel, 'labels.cancel'),
    },
    statuses: requireStringArray(config.statuses, 'statuses', { length: 8, unique: true }),
    ciWorkflow: requireString(config.ciWorkflow, 'ciWorkflow'),
    ciRetryLimit: requirePositiveInteger(config.ciRetryLimit, 'ciRetryLimit'),
    defaultBranch: requireString(config.defaultBranch, 'defaultBranch'),
    cursorBranchPrefix: requireString(config.cursorBranchPrefix, 'cursorBranchPrefix'),
  };
}
