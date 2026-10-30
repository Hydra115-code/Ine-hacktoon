import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assertOfficialUrl, downloadData, parseArguments } from '../scripts/ccpc/download-data.ts';
import type { Source } from '../scripts/ccpc/download-data.ts';
import { CCPC_YEARS } from '../scripts/ccpc/years.ts';

const runFile = promisify(execFile);

const ZIP_BYTES = Buffer.from([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5]);
const HASH = createHash('sha256').update(ZIP_BYTES).digest('hex');
const SOURCE: Source = {
  year: 2024,
  filename: 'ccpc2024.zip',
  url: 'https://portal.ine.mx/ccpc2024.zip',
  landing_url: 'https://www.ine.mx/ccpc/',
  sha256: HASH,
};
const FIRST_DATE = '2026-10-12T12:00:00.000Z';
const LATER_DATE = '2026-10-12T13:00:00.000Z';

async function temporaryDirectory(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'ccpc-download-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

function zipResponse(): Response {
  // Deliberately split the ZIP signature across chunks.
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(ZIP_BYTES.subarray(0, 1));
      controller.enqueue(ZIP_BYTES.subarray(1, 3));
      controller.enqueue(ZIP_BYTES.subarray(3));
      controller.close();
    },
  }), { headers: { 'content-type': 'application/zip' } });
}

test('streams, verifies and records provenance; a cache hit preserves the download date', async (t) => {
  const outputDir = await temporaryDirectory(t);
  let calls = 0;
  const fetchImpl = (async (_input, init) => {
    calls += 1;
    assert.equal(init?.redirect, 'manual');
    return zipResponse();
  }) as typeof fetch;
  const first = await downloadData({ sources: [SOURCE], outputDir, fetchImpl, now: () => new Date(FIRST_DATE) });
  assert.deepEqual(await readFile(join(outputDir, SOURCE.filename)), ZIP_BYTES);
  assert.deepEqual(first[0], {
    year: 2024, url: SOURCE.url, final_url: SOURCE.url,
    sha256: HASH, bytes: ZIP_BYTES.length, downloaded_at: FIRST_DATE, verified_at: FIRST_DATE,
  });
  const second = await downloadData({ sources: [SOURCE], outputDir, fetchImpl, now: () => new Date(LATER_DATE) });
  assert.equal(calls, 1);
  assert.equal(second[0].downloaded_at, FIRST_DATE);
  assert.equal(second[0].verified_at, LATER_DATE);
  const manifest = JSON.parse(await readFile(join(outputDir, 'downloads.json'), 'utf8'));
  assert.equal(manifest.schema_version, 1);
  assert.deepEqual(manifest.downloads, second);
  assert.deepEqual((await readdir(outputDir)).sort(), ['ccpc2024.zip', 'downloads.json']);
});

test('a local ZIP without provenance is verified without inventing a download date or final URL', async (t) => {
  const outputDir = await temporaryDirectory(t);
  await writeFile(join(outputDir, SOURCE.filename), ZIP_BYTES);
  const fetchImpl = (async () => { throw new Error('Cache must not request the network.'); }) as typeof fetch;
  const [record] = await downloadData({ sources: [SOURCE], outputDir, fetchImpl, now: () => new Date(FIRST_DATE) });
  assert.equal(record.downloaded_at, null);
  assert.equal(record.final_url, null);
  assert.equal(record.verified_at, FIRST_DATE);
});

for (const [label, fetchImpl, pattern] of [
  ['HTTP error', async () => new Response('missing', { status: 404 }), /HTTP 404/],
  ['HTML response', async () => new Response('<html>error</html>'), /firma ZIP/],
  ['truncated signature', async () => new Response('PK'), /incompleto/],
  ['wrong checksum', async () => new Response(Buffer.concat([ZIP_BYTES, Buffer.from([7])])), /SHA-256 distinto/],
] as const) {
  test(`${label} leaves no ZIP, temporary file or false provenance`, async (t) => {
    const outputDir = await temporaryDirectory(t);
    await assert.rejects(downloadData({ sources: [SOURCE], outputDir, fetchImpl: fetchImpl as typeof fetch }), pattern);
    assert.deepEqual(await readdir(outputDir), []);
  });
}

test('an official redirect is followed and recorded', async (t) => {
  const outputDir = await temporaryDirectory(t);
  const requested: string[] = [];
  const finalUrl = 'https://ine.mx/ccpc2024-final.zip';
  const fetchImpl = (async (input) => {
    requested.push(String(input));
    return requested.length === 1
      ? new Response(null, { status: 302, headers: { location: finalUrl } }) : zipResponse();
  }) as typeof fetch;
  const [record] = await downloadData({ sources: [SOURCE], outputDir, fetchImpl });
  assert.deepEqual(requested, [SOURCE.url, finalUrl]);
  assert.equal(record.final_url, finalUrl);
});

test('redirects outside official HTTPS domains are rejected before a second request', async (t) => {
  const outputDir = await temporaryDirectory(t);
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(null, { status: 302, headers: { location: 'https://ine.mx.example.org/file.zip' } });
  }) as typeof fetch;
  await assert.rejects(downloadData({ sources: [SOURCE], outputDir, fetchImpl }), /dominio oficial/);
  assert.equal(calls, 1);
  assert.deepEqual(await readdir(outputDir), []);
});

test('a modified local ZIP is preserved and not silently replaced', async (t) => {
  const outputDir = await temporaryDirectory(t);
  const modified = Buffer.concat([ZIP_BYTES, Buffer.from([99])]);
  await writeFile(join(outputDir, SOURCE.filename), modified);
  const fetchImpl = (async () => { throw new Error('Must not fetch over existing evidence.'); }) as typeof fetch;
  await assert.rejects(downloadData({ sources: [SOURCE], outputDir, fetchImpl }), /ZIP local.*SHA-256 distinto/);
  assert.deepEqual(await readFile(join(outputDir, SOURCE.filename)), modified);
  assert.deepEqual(await readdir(outputDir), [SOURCE.filename]);
});

test('official URL validation rejects lookalikes, HTTP and credentials', () => {
  for (const url of ['http://ine.mx/file.zip', 'https://ine.mx.evil.test/file.zip', 'https://user:pass@ine.mx/file.zip']) {
    assert.throws(() => assertOfficialUrl(url), /dominio oficial/);
  }
  assert.equal(assertOfficialUrl(SOURCE.url).hostname, 'portal.ine.mx');
});

test('CLI arguments reject missing values and unsupported years', () => {
  assert.equal(parseArguments([]).year, 'all');
  for (const year of CCPC_YEARS) assert.equal(parseArguments(['--year', String(year)]).year, String(year));
  assert.equal(parseArguments(['--year', 'all']).year, 'all');
  assert.equal(parseArguments(['--output', '.']).outputDir, resolve('.'));
  assert.equal(parseArguments(['--help']).help, true);
  assert.equal(parseArguments(['-h']).help, true);
  for (const value of ['2026', '2024.0', '02024', ' 2024']) {
    assert.throws(() => parseArguments(['--year', value]), /--year/);
  }
  assert.throws(() => parseArguments(['--year']), /--year/);
  assert.throws(() => parseArguments(['--output']), /--output/);
  assert.throws(() => parseArguments(['--output', '--year', '2024']), /--output/);
  assert.throws(() => parseArguments(['--output', '-h']), /--output/);
  assert.throws(() => parseArguments(['--unknown']), /desconocido/);
  for (const flags of [
    ['--year', '2018', '--year', '2024'],
    ['--output', '.', '--output', 'other'],
    ['--help', '-h'],
  ]) assert.throws(() => parseArguments(flags), /duplicado/);
});

test('all six cuts stream and preserve each original acquisition on a later cache run', async (t) => {
  const outputDir = await temporaryDirectory(t);
  const sources = CCPC_YEARS.map(year => ({ ...SOURCE, year, filename: `ccpc${year}.zip`, url: `https://portal.ine.mx/ccpc${year}.zip` }));
  let calls = 0;
  const fetchImpl = (async () => { calls += 1; return zipResponse(); }) as typeof fetch;
  const first = await downloadData({ sources, outputDir, fetchImpl, now: () => new Date(FIRST_DATE) });
  assert.deepEqual(first.map(record => record.year), CCPC_YEARS);
  const later = await downloadData({ sources, outputDir, fetchImpl, now: () => new Date(LATER_DATE) });
  assert.equal(calls, 6);
  assert.equal(later.every(record => record.downloaded_at === FIRST_DATE && record.verified_at === LATER_DATE), true);
  const manifest = JSON.parse(await readFile(join(outputDir, 'downloads.json'), 'utf8'));
  assert.deepEqual(manifest.downloads, later);
});

test('unknown cached download dates and final URLs stay unknown across verifications', async (t) => {
  const outputDir = await temporaryDirectory(t);
  await writeFile(join(outputDir, SOURCE.filename), ZIP_BYTES);
  await writeFile(join(outputDir, 'downloads.json'), JSON.stringify({ schema_version: 1, downloads: [{
    year: SOURCE.year, url: SOURCE.url, sha256: HASH, bytes: ZIP_BYTES.length,
    final_url: null, downloaded_at: null, verified_at: FIRST_DATE,
  }] }));
  const fetchImpl = (async () => { throw new Error('Cache must not request the network.'); }) as typeof fetch;
  const [record] = await downloadData({ sources: [SOURCE], outputDir, fetchImpl, now: () => new Date(LATER_DATE) });
  assert.equal(record.downloaded_at, null);
  assert.equal(record.final_url, null);
  assert.equal(record.verified_at, LATER_DATE);
});

test('malformed cached metadata fails before network use or provenance replacement', async (t) => {
  const outputDir = await temporaryDirectory(t);
  const fetchImpl = (async () => { throw new Error('Invalid provenance must not request the network.'); }) as typeof fetch;
  for (const changes of [
    { downloaded_at: '2026-10-12' },
    { downloaded_at: '2026-02-30T12:00:00Z' },
    { verified_at: '2026-10-12T12:00:00' },
    { final_url: 'https://evil.test/file.zip' },
    { year: 2026 },
  ]) {
    const contents = JSON.stringify({ schema_version: 1, downloads: [{
      year: 2009, url: 'https://portal.ine.mx/ccpc2009.zip', sha256: HASH, bytes: ZIP_BYTES.length,
      final_url: null, downloaded_at: null, verified_at: FIRST_DATE, ...changes,
    }] });
    await writeFile(join(outputDir, 'downloads.json'), contents);
    await assert.rejects(downloadData({ sources: [SOURCE], outputDir, fetchImpl }), /ISO|dominio oficial|año entero/);
    assert.equal(await readFile(join(outputDir, 'downloads.json'), 'utf8'), contents);
    assert.deepEqual(await readdir(outputDir), ['downloads.json']);
  }
});

test('duplicate source years, URLs or case-insensitive filenames fail before downloading', async (t) => {
  const outputDir = await temporaryDirectory(t);
  const other: Source = { ...SOURCE, year: 2021, filename: 'ccpc2021.zip', url: 'https://portal.ine.mx/ccpc2021.zip' };
  for (const source of [
    { ...other, year: SOURCE.year },
    { ...other, url: SOURCE.url },
    { ...other, filename: SOURCE.filename.toUpperCase() },
  ]) {
    await assert.rejects(downloadData({ sources: [SOURCE, source], outputDir }), /duplicados/);
    assert.deepEqual(await readdir(outputDir), []);
  }
});

test('CLI validates the entire catalog before a single-year run and documents all six years', async (t) => {
  const temporary = await temporaryDirectory(t);
  const scriptDir = join(temporary, 'scripts', 'ccpc');
  const dataDir = join(temporary, 'data', 'ccpc');
  await mkdir(scriptDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  for (const filename of ['download-data.ts', 'validation.ts', 'years.ts']) {
    await writeFile(join(scriptDir, filename), await readFile(new URL(`../scripts/ccpc/${filename}`, import.meta.url)));
  }
  await writeFile(join(temporary, 'package.json'), '{"type":"module"}');
  const sources = CCPC_YEARS.slice(1).map(year => ({ ...SOURCE, year, filename: `ccpc${year}.zip`, url: `https://portal.ine.mx/ccpc${year}.zip` }));
  await writeFile(join(dataDir, 'sources.json'), JSON.stringify({ schema_version: 1, sources }));
  const outputDir = join(temporary, 'raw');
  await assert.rejects(runFile(process.execPath, [join(scriptDir, 'download-data.ts'), '--year', '2024', '--output', outputDir]), /exactamente las seis fuentes/);
  await assert.rejects(access(outputDir), { code: 'ENOENT' });
  const { stdout } = await runFile(process.execPath, [fileURLToPath(new URL('../scripts/ccpc/download-data.ts', import.meta.url)), '--help']);
  assert.match(stdout, /2009\|2012\|2015\|2018\|2021\|2024\|all/);
});
