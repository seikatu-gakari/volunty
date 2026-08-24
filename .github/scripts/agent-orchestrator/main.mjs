import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.mjs';
import { GitHubApiError, GitHubClient } from './github.mjs';
import { createHandlers } from './handlers.mjs';
import { ProjectStore } from './project.mjs';
import { AgentRepository } from './repository.mjs';

const CONFIG_PATH = fileURLToPath(new URL('../../agent-orchestrator.json', import.meta.url));
const COMMANDS = new Set(['start', 'pr-created', 'comments', 'ci', 'review', 'merge', 'cancel']);

const resultLabels = {
  preflight: '事前確認が完了しました',
  initialized: 'Issue の初期化が完了しました',
  dispatch: 'Cursor への起動依頼が完了しました',
  're-evaluated': '依存 Issue の再評価が完了しました',
  transition: 'Status の更新が完了しました',
  retry: 'CI 修正依頼を投稿しました',
  unchanged: '既に処理済みです',
  skip: '安全に処理を見送りました',
};

const reasonLabels = {
  'invalid-repository': '対象 repository が設定と一致しません',
  'unsupported-event': '対象外の event です',
  'invalid-issue': 'Issue を特定できません',
  'invalid-pull-request': 'Pull Request を特定できません',
  'unrelated-label': '対象外の label です',
  terminal: 'terminal Status のため変更しません',
  'stale-session': '最新 session と一致しません',
  'stale-head': '最新 commit と一致しません',
  'stale-run': '最新 CI run と一致しません',
  'unmatched-comment': '状態遷移に使える comment ではありません',
  'already-retried': '同じ CI run は処理済みです',
  'invalid-status': '現在の Status では処理できません',
};

/** @param {unknown} value @param {string} name */
function requireEnvironmentValue(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} must be a non-empty string`);
  return value;
}

/** @param {string} path */
function readEvent(path) {
  let event;
  try {
    event = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('GITHUB_EVENT_PATH must contain valid JSON');
  }
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('GitHub event must be an object');
  }
  return event;
}

/** @param {unknown} value */
function safeReason(value) {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,80}$/u.test(value)) return '内部の安全確認で処理を見送りました';
  return reasonLabels[value] ?? `安全確認により処理を見送りました（理由コード: ${value}）`;
}

/** @param {unknown} value */
function safeHandlerSummary(value) {
  if (typeof value !== 'string') return null;
  let match = value.match(/^Issue #(\d+): Cursor dispatch posted$/u);
  if (match) return `Issue #${match[1]}: Cursor 起動依頼を投稿しました`;
  match = value.match(/^Read-only preflight: project=(\d+), statusField=(\d+)$/u);
  if (match) return `読み取り専用の事前確認: Project=${match[1]}, Status field=${match[2]}`;
  match = value.match(/^PR #(\d+): Draft ACK completed$/u);
  if (match) return `PR #${match[1]}: Draft PR ACK が完了しました`;
  return null;
}

/** @param {unknown[]} lines @param {unknown} result */
function renderSummary(lines, result) {
  const record = result !== null && typeof result === 'object' && !Array.isArray(result) ? result : {};
  const kind = typeof record.kind === 'string' ? record.kind : 'completed';
  const outcome = resultLabels[kind] ?? '処理が完了しました';
  const body = ['## Agent Orchestrator', ''];
  for (const line of lines) {
    const safeLine = safeHandlerSummary(line);
    if (safeLine !== null) body.push(`- ${safeLine}`);
  }
  body.push(`- 結果: ${outcome}`);
  if (Object.hasOwn(record, 'reason')) body.push(`- 理由: ${safeReason(record.reason)}`);
  if (typeof record.status === 'string' && /^[A-Za-z ]{1,40}$/u.test(record.status)) body.push(`- Status: ${record.status}`);
  if (Number.isSafeInteger(record.retry) && record.retry > 0) body.push(`- CI 修正依頼: ${record.retry} 回目`);
  return `${body.join('\n')}\n`;
}

/**
 * 固定 command と handler の対応を一か所に閉じ込めます。
 * @param {string} command
 * @param {ReturnType<typeof createHandlers>} handlers
 * @param {Record<string, unknown>} event
 * @param {string} eventName
 */
export async function dispatchCommand(command, handlers, event, eventName) {
  switch (command) {
    case 'start': return handlers.handleStart(event, { eventName });
    case 'pr-created': return handlers.handlePrCreated(event);
    case 'comments': return handlers.handleComment(event);
    case 'ci': return handlers.handleCi(event);
    case 'review': return handlers.handleReview(event);
    case 'merge': return handlers.handleMerge(event);
    case 'cancel': return handlers.handleCancel(event);
    default: throw new Error('unsupported command');
  }
}

/**
 * @param {{
 *   args?: string[],
 *   env?: Record<string, string | undefined>,
 *   configPath?: string,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 */
export async function runMain({
  args = process.argv.slice(2),
  env = process.env,
  configPath = CONFIG_PATH,
  fetchImpl = fetch,
} = {}) {
  if (!Array.isArray(args) || args.length !== 1) throw new Error('expected exactly one command');
  const command = args[0];
  if (!COMMANDS.has(command)) throw new Error('unsupported command');

  const eventPath = requireEnvironmentValue(env.GITHUB_EVENT_PATH, 'GITHUB_EVENT_PATH');
  const summaryPath = requireEnvironmentValue(env.GITHUB_STEP_SUMMARY, 'GITHUB_STEP_SUMMARY');
  const readToken = requireEnvironmentValue(env.GITHUB_TOKEN, 'GITHUB_TOKEN');
  // PAT は mutation が必要になった時点で GitHubClient が検証する。これにより
  // read-only preflight と non-managed event は秘密値なしでも安全に no-op できる。
  const writeToken = env.CURSOR_AGENT_ORCHESTRATOR_PAT;
  const eventName = requireEnvironmentValue(env.GITHUB_EVENT_NAME, 'GITHUB_EVENT_NAME');
  const event = readEvent(eventPath);
  const config = loadConfig(configPath);
  const client = new GitHubClient({ readToken, writeToken, fetchImpl });
  const repository = new AgentRepository({ client, config });
  const project = new ProjectStore({ client, config });
  const summaryLines = [];
  const handlers = createHandlers({
    repository,
    project,
    config,
    summary: { add: (line) => summaryLines.push(line) },
  });
  const result = await dispatchCommand(command, handlers, event, eventName);
  appendFileSync(summaryPath, renderSummary(summaryLines, result), 'utf8');
  return result;
}

function appendFailureSummary(path, error) {
  if (typeof path !== 'string' || path.trim() === '') return;
  try {
    const reason = error instanceof GitHubApiError
      ? `GitHub API が HTTP ${error.status} を返しました`
      : '入力、設定、または処理途中の安全確認に失敗しました';
    appendFileSync(path, `## Agent Orchestrator\n\n- 結果: 処理に失敗しました\n- 理由: ${reason}\n`, 'utf8');
  } catch {
    // summary 自体を書けない場合も、秘密値や event 本文は標準出力へ退避しない。
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runMain();
  } catch (error) {
    appendFailureSummary(process.env.GITHUB_STEP_SUMMARY, error);
    console.error('Agent Orchestrator: 処理に失敗しました。');
    process.exitCode = 1;
  }
}
