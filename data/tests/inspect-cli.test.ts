import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const MODULE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const runFile = promisify(execFile);

async function isolatedModule(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'ccpc-inspect-cli-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = join(root, 'data', 'ccpc', 'sample');
  await mkdir(fixture, { recursive: true });
  // Execute the actual CLI code in a disposable module with no source ZIPs.
  // Copy the three installed runtime packages rather than linking live folders.
  await Promise.all([
    cp(join(MODULE_ROOT, 'scripts'), join(root, 'scripts'), { recursive: true }),
    cp(join(MODULE_ROOT, 'package.json'), join(root, 'package.json')),
    cp(join(MODULE_ROOT, 'data', 'ccpc', 'sources.json'), join(root, 'data', 'ccpc', 'sources.json')),
    ...['csv-parse', 'yauzl', 'pend'].map(name =>
      cp(join(MODULE_ROOT, 'node_modules', name), join(root, 'node_modules', name), { recursive: true })),
  ]);
  await writeFile(join(fixture, 'entidad.csv'), 'existing,fixture\n01,conserved\n');
  await writeFile(join(fixture, 'provenance.json'), '{"fixture":"existing"}\n');
  await writeFile(join(fixture, 'dictionary-2009.txt'), 'Diccionario existente: México.\n');
  return { root, fixture, script: join(root, 'scripts', 'ccpc', 'inspect-data.ts') };
}

async function snapshot(directory: string): Promise<Array<{ path: string; sha256: string | null }>> {
  const result: Array<{ path: string; sha256: string | null }> = [];
  async function visit(path: string, prefix: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        result.push({ path: `${relative}/`, sha256: null });
        await visit(join(path, entry.name), relative);
      } else {
        result.push({ path: relative, sha256: createHash('sha256').update(await readFile(join(path, entry.name))).digest('hex') });
      }
    }
  }
  await visit(directory, '');
  return result;
}

async function expectRejection(script: string, args: string[], pattern: RegExp): Promise<void> {
  await assert.rejects(runFile(process.execPath, [script, ...args]), error => {
    const failure = error as Error & { code: number; stdout: string; stderr: string };
    assert.equal(failure.code, 1);
    assert.equal(failure.stdout, '', 'No source CSV should have been inspected.');
    assert.match(failure.stderr, pattern);
    return true;
  });
}

test('inspect CLI rejects output at or inside the fixture before reading ZIPs; existing fixture bytes remain unchanged', async t => {
  const { root, fixture, script } = await isolatedModule(t);
  const before = await snapshot(fixture);
  assert.equal(before.length, 3, 'Test a nonempty existing fixture.');
  await assert.rejects(access(join(root, 'data', 'ccpc', 'raw')), { code: 'ENOENT' });
  for (const output of [fixture, join(fixture, 'nested', 'full-data')]) {
    await expectRejection(script, ['--year', '2009', '--zip-2009', join(root, 'never-opened.zip'), '--output', output],
      /--output no puede publicar datos completos dentro de data\/ccpc\/sample/);
    assert.deepEqual(await snapshot(fixture), before, 'No existing file may change and no file or directory may be added.');
  }
});

test('inspect CLI rejects an unsupported year before accessing archives or changing the fixture', async t => {
  const { root, fixture, script } = await isolatedModule(t);
  const before = await snapshot(fixture);
  const output = join(root, 'rejected-output');
  await expectRejection(script, ['--year', '2010', '--output', output], /Año solicitado: admite 2009, 2012, 2015, 2018, 2021, 2024 o all/);
  await assert.rejects(access(output), { code: 'ENOENT' });
  assert.deepEqual(await snapshot(fixture), before);
});

test('inspect CLI requires all six cuts for sample mode and preserves an existing fixture on rejection', async t => {
  const { root, fixture, script } = await isolatedModule(t);
  const before = await snapshot(fixture);
  const output = join(root, 'rejected-output');
  await expectRejection(script, ['--sample', '--year', '2009', '--output', output], /--sample requiere --year all/);
  await assert.rejects(access(output), { code: 'ENOENT' });
  assert.deepEqual(await snapshot(fixture), before);
});
