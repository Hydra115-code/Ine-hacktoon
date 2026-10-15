import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { CivicParticipationError } from '../../src/domain/civic/participation.ts';
import type { ParticipationDataset } from '../../src/domain/civic/participation.ts';
import { parseParticipationDataset } from '../../src/schemas/civic/participation.schema.ts';

/** Claves ordenadas por código Unicode; no usa locale, reloj ni rutas locales. */
export function canonicalJson(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, child]) => [key, canonical(child)]));
    }
    return item;
  };
  return JSON.stringify(canonical(value), null, 2) + '\n';
}
export function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
export function serializeDataset(input: unknown): string {
  return canonicalJson(parseParticipationDataset(input));
}
export function createManifest(dataset: ParticipationDataset, bytes: string | Buffer) {
  return {
    schemaVersion: 'ccpc-etl-manifest/v1',
    datasetFile: 'participation.json',
    datasetSha256: sha256(bytes),
    recordsSha256: sha256(canonicalJson(dataset.records)),
    recordCount: dataset.records.length,
    sourceCount: dataset.sources.length,
    rawRowCount: dataset.sources.reduce((sum, source) => sum + source.rawRows, 0),
    years: dataset.years,
    kind: dataset.kind,
  };
}
export function checkManifest(dataset: ParticipationDataset, bytes: string | Buffer, manifest: unknown): void {
  if (canonicalJson(manifest) !== canonicalJson(createManifest(dataset, bytes))) {
    throw new CivicParticipationError('MANIFEST_MISMATCH', 'El manifiesto no coincide con bytes, filas, fuentes o años del dataset.');
  }
}
export function parseJsonBytes(bytes: Buffer, label: string): unknown {
  let decoded: string;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new CivicParticipationError('INVALID_ENCODING', `Se requiere UTF-8 válido en ${label}.`); }
  try { return JSON.parse(decoded); }
  catch (error) {
    if (error instanceof SyntaxError) throw new CivicParticipationError('INVALID_JSON', `JSON inválido en ${label}: ${error.message}`);
    throw error;
  }
}
export async function readJson(path: string): Promise<unknown> {
  return parseJsonBytes(await readFile(path), path);
}

/** Publica sólo bytes ya validados. Bloqueo exclusivo y restauración ante fallo de I/O. */
export async function publishDataset(out: string, input: unknown): Promise<void> {
  const dataset = parseParticipationDataset(input);
  const bytes = canonicalJson(dataset);
  const manifest = createManifest(dataset, bytes);
  checkManifest(dataset, bytes, manifest);
  const manifestBytes = canonicalJson(manifest);
  const files = [
    ['participation.json', bytes],
    ['manifest.json', manifestBytes],
    ['checksums.sha256', `${sha256(bytes)}  participation.json\n${sha256(manifestBytes)}  manifest.json\n`],
  ] as const;
  await mkdir(out, { recursive: true });
  const lockPath = join(out, '.ccpc-etl.lock');
  const lock = await open(lockPath, 'wx').catch(error => {
    if (error.code === 'EEXIST') throw new CivicParticipationError('OUTPUT_LOCKED', 'Otra publicación utiliza este directorio.');
    throw error;
  });
  const token = randomUUID();
  const old = new Set<string>(), installed = new Set<string>();
  const staged = new Set<string>();
  let safeToCleanBackups = false;
  try {
    for (const [name] of files) {
      const existing = await lstat(join(out,name)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new CivicParticipationError('INVALID_OUTPUT_TARGET',`La salida ${name} debe ser un archivo regular.`);
    }
    for (const [name, contents] of files) {
      const handle = await open(join(out, `${name}.${token}.part`),'wx');
      staged.add(name);
      try { await handle.writeFile(contents); } finally { await handle.close(); }
    }
    for (const [name] of files) {
      const backupExists = await lstat(join(out, `${name}.${token}.backup`)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (backupExists) throw new CivicParticipationError('OUTPUT_COLLISION','La ruta temporal de respaldo ya existe.');
      try { await rename(join(out, name), join(out, `${name}.${token}.backup`)); old.add(name); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    for (const [name] of files) {
      await rename(join(out, `${name}.${token}.part`), join(out, name)); installed.add(name);
    }
    safeToCleanBackups = true;
  } catch (error) {
    for (const name of installed) await rm(join(out, name), { force: true });
    for (const name of old) await rename(join(out, `${name}.${token}.backup`), join(out, name));
    safeToCleanBackups = true;
    throw error;
  } finally {
    await lock.close();
    for (const [name] of files) {
      if (staged.has(name)) await rm(join(out, `${name}.${token}.part`), { force: true });
      if (safeToCleanBackups && old.has(name)) await rm(join(out, `${name}.${token}.backup`), { force: true });
    }
    await rm(lockPath, { force: true });
  }
}
