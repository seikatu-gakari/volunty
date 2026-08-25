import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { loadConfig } from './config.mjs';

const validConfig = {
  owner: 'seikatu-gakari',
  repository: 'volunty',
  projectNumber: 2,
  operator: 'yuto90',
  agentActors: ['yuto90', 'cursor[bot]'],
  labels: { ready: 'agent-ready', cancel: 'agent-cancel' },
  statuses: [
    'Backlog',
    'In Progress',
    'Human Input',
    'Human Review',
    'Rework',
    'Blocked',
    'Done',
    'Cancelled',
  ],
  ciWorkflow: 'Pull Request CI',
  ciRetryLimit: 3,
  defaultBranch: 'main',
  cursorBranchPrefix: 'cursor/',
};

async function withConfig(value, assertion) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-orchestrator-config-'));
  const path = join(directory, 'config.json');

  try {
    await writeFile(path, JSON.stringify(value));
    await assertion(path);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('有効な設定を読み込む', async () => {
  await withConfig(validConfig, (path) => {
    assert.deepEqual(loadConfig(path), validConfig);
  });
});

test('設定のobject、string、positive integerを検証する', async () => {
  const cases = [
    { value: null, field: 'config' },
    { value: [], field: 'config' },
    { value: { ...validConfig, owner: '' }, field: 'owner' },
    { value: { ...validConfig, projectNumber: 0 }, field: 'projectNumber' },
    { value: { ...validConfig, ciRetryLimit: 1.5 }, field: 'ciRetryLimit' },
    { value: { ...validConfig, labels: null }, field: 'labels' },
    { value: { ...validConfig, labels: { ready: 'agent-ready' } }, field: 'labels.cancel' },
    { value: { ...validConfig, agentActors: ['yuto90', ''] }, field: 'agentActors[1]' },
  ];

  for (const { value, field } of cases) {
    await withConfig(value, (path) => {
      assert.throws(() => loadConfig(path), new RegExp(field.replace(/[.[\]]/g, '\\$&')));
    });
  }
});

test('Statusは8件の一意な文字列だけを受け入れる', async () => {
  const cases = [
    { statuses: validConfig.statuses.slice(0, 7), field: 'statuses' },
    { statuses: [...validConfig.statuses.slice(0, 7), 'Backlog'], field: 'statuses' },
    { statuses: [...validConfig.statuses.slice(0, 7), ''], field: 'statuses[7]' },
  ];

  for (const { statuses, field } of cases) {
    await withConfig({ ...validConfig, statuses }, (path) => {
      assert.throws(() => loadConfig(path), new RegExp(field.replace(/[.[\]]/g, '\\$&')));
    });
  }
});
