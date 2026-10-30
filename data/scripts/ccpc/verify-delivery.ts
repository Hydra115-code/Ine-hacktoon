import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
type Entry = { path: string; bytes: number; sha256: string };

export async function verifyDelivery(): Promise<number> {
  const manifest: unknown = JSON.parse(await readFile(resolve(ROOT, 'DELIVERY-MANIFEST.json'), 'utf8'));
  if (manifest === null || typeof manifest !== 'object' || !('schemaVersion' in manifest) ||
      manifest.schemaVersion !== 'ccpc-delivery/v1' || !('files' in manifest) ||
      !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('DELIVERY_INVALID_MANIFEST: formato de inventario inválido.');
  }
  const seen = new Set<string>();
  for (const item of manifest.files as Entry[]) {
    if (item === null || typeof item !== 'object' || typeof item.path !== 'string' ||
        !/^[A-Za-z0-9._/-]+$/.test(item.path) || item.path.split('/').some(part => !part || part === '.' || part === '..') ||
        seen.has(item.path) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new Error('DELIVERY_INVALID_ENTRY: ruta, tamaño o huella de inventario inválidos.');
    }
    seen.add(item.path);
    const target = resolve(ROOT, item.path);
    if (!target.startsWith(ROOT + sep)) throw new Error('DELIVERY_INVALID_PATH: ruta fuera del módulo.');
    const bytes = await readFile(target);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== item.bytes || actual !== item.sha256) {
      throw new Error(`DELIVERY_MISMATCH: bytes diferentes en ${item.path}.`);
    }
  }
  return seen.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyDelivery().then(count => console.log(`Entrega íntegra: ${count} archivos verificados por SHA-256.`))
    .catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
