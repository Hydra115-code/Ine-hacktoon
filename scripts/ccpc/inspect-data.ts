import { createReadStream } from 'node:fs';
import { readFile, mkdir, writeFile, rename, rm, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, dirname, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { parse } from 'csv-parse';
import { HEADER, normalize, key, emptyCounts, addCounts, metrics, sortRows, selectSample, toCsv } from './model.ts';
import type { Row, Counts } from './model.ts';
import type { Source } from './download-data.ts';
import { validateCatalog, validateAcquisition } from './validation.ts';
import { CCPC_YEARS, parseSelectedYear } from './years.ts';
import { createMissingProfile, observeMissing, mergeMissing, createNameProfile, observeEntityName, compareEntityNames, createEncodingProbe } from './quality.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((ok, fail) => yauzl.open(path, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (error, zip) => error ? fail(error) : ok(zip!)));
}
async function closeZip(zip: yauzl.ZipFile): Promise<void> {
  if (!zip.isOpen) return;
  await new Promise<void>((ok, fail) => {
    const clean = () => { zip.off('close', closed); zip.off('error', failed); };
    const closed = () => { clean(); ok(); };
    const failed = (error: Error) => { clean(); fail(error); };
    zip.once('close', closed); zip.once('error', failed); zip.close();
  });
}
function nextEntry(zip: yauzl.ZipFile): Promise<yauzl.Entry | null> {
  return new Promise((ok, fail) => {
    const clean = () => { zip.off('entry', entry); zip.off('end', end); zip.off('error', error); };
    const entry = (value: yauzl.Entry) => { clean(); ok(value); };
    const end = () => { clean(); ok(null); };
    const error = (value: Error) => { clean(); fail(value); };
    zip.once('entry', entry); zip.once('end', end); zip.once('error', error); zip.readEntry();
  });
}
function entryStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((ok, fail) => zip.openReadStream(entry, (error, stream) => error ? fail(error) : ok(stream!)));
}
async function acquisition(path: string, source: Source) {
  let metadata: unknown;
  try { metadata = JSON.parse(await readFile(join(dirname(path), 'downloads.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  return validateAcquisition(metadata, source, (await stat(path)).size);
}
export async function inspectArchive(source: Source, path: string) {
  const sha = await hashFile(path);
  if (sha !== source.sha256) throw new Error(`${source.year}: SHA-256 del ZIP distinto del catálogo; revisar fuente antes de cambiar el pin`);
  const zip = await openZip(path);
  const aggregate = new Map<string, Row>();
  const groupSourceRows = new Map<string, number>();
  const members: Array<Record<string, unknown>> = [];
  const states = new Set<string>();
  const names = new Map<string, string>();
  const dates = new Set<string>();
  const sexes = new Set<string>();
  const types = new Set<string>();
  const missingValues = createMissingProfile();
  const nameProfile = createNameProfile();
  let dictionary: { member: string; bytes: Buffer; sha256: string; encoding: ReturnType<ReturnType<typeof createEncodingProbe>['result']> } | undefined;
  let rowCount = 0, minAge = Infinity, maxAge = 0;
  try {
    let entry: yauzl.Entry | null;
    while ((entry = await nextEntry(zip))) {
      if (/\/$/.test(entry.fileName)) continue;
      if (/\.txt$/i.test(entry.fileName)) {
        if (dictionary) throw new Error('Más de un diccionario TXT; revisar el ZIP');
        if (entry.uncompressedSize > 100_000) throw new Error('Diccionario inesperadamente grande');
        const chunks: Buffer[] = [];
        const dictionaryEncoding = createEncodingProbe();
        const dictionaryPump = pipeline(await entryStream(zip, entry), dictionaryEncoding.stream);
        void dictionaryPump.catch(() => {});
        try {
          for await (const chunk of dictionaryEncoding.stream) chunks.push(Buffer.from(chunk));
          await dictionaryPump;
        } catch (error) { dictionaryEncoding.stream.destroy(); await dictionaryPump.catch(() => {}); throw error; }
        const bytes = Buffer.concat(chunks);
        dictionary = { member: entry.fileName, bytes, sha256: createHash('sha256').update(bytes).digest('hex'), encoding: dictionaryEncoding.result() };
        continue;
      }
      if (!/\.csv$/i.test(entry.fileName)) throw new Error(`Miembro inesperado: ${entry.fileName}`);
      const stream = await entryStream(zip, entry);
      const hash = createHash('sha256');
      const hasher = new Transform({ transform(chunk, _encoding, callback) { hash.update(chunk); callback(null, chunk); } });
      const encoding = createEncodingProbe();
      const memberMissing = createMissingProfile();
      let headerSeen = false;
      const parser = parse({ bom: true, columns: (header: string[]) => {
        headerSeen = true;
        if (header.join(',') !== HEADER.join(',')) throw new Error(`Esquema distinto: ${entry!.fileName}`);
        return header;
      }, skip_empty_lines: true, relax_column_count: false });
      const pump = pipeline(stream, hasher, encoding.stream, parser);
      void pump.catch(() => {});
      const seen = new Set<string>();
      let memberState: string | undefined;
      let memberRows = 0;
      const total = emptyCounts();
      try {
        for await (const record of parser as AsyncIterable<Record<string, string>>) {
          observeMissing(memberMissing, record);
          const row = normalize(record, source.year);
          observeEntityName(nameProfile, row.entidad_clave, record.EDONOM);
          if (memberState && row.entidad_clave !== memberState) throw new Error('CSV contiene varias entidades');
          memberState = row.entidad_clave;
          if (names.has(row.entidad_clave) && names.get(row.entidad_clave) !== row.entidad) throw new Error('Nombres contradictorios de entidad');
          names.set(row.entidad_clave, row.entidad);
          const municipality = Number(record.MPIOCVE);
          const section = Number(record.SECCION);
          if (!/^\d+$/.test(record.MPIOCVE) || !/^\d+$/.test(record.SECCION) || !Number.isSafeInteger(municipality) || !Number.isSafeInteger(section)) throw new Error('Clave cruda inválida para control de duplicados');
          const rawKey = [municipality, section, row.sexo_codigo, Number(record.EDAD)].join('|');
          if (seen.has(rawKey)) throw new Error(`Clave cruda duplicada en ${entry!.fileName}`);
          seen.add(rawKey);
          const groupKey = key(row);
          groupSourceRows.set(groupKey, (groupSourceRows.get(groupKey) ?? 0) + 1);
          if (!aggregate.has(groupKey)) aggregate.set(groupKey, { ...row, ...emptyCounts() });
          addCounts(aggregate.get(groupKey)!, row); addCounts(total, row);
          dates.add(record.FELECCION); sexes.add(record.SEXO); types.add(record.TIPOSEC);
          minAge = Math.min(minAge, Number(record.EDAD)); maxAge = Math.max(maxAge, Number(record.EDAD));
          memberRows++; rowCount++;
        }
        await pump;
      } catch (error) { parser.destroy(); await pump.catch(() => {}); throw error; }
      if (!headerSeen || !memberState || memberRows === 0) throw new Error('CSV vacío o sin encabezado');
      if (states.has(memberState)) throw new Error(`Entidad repetida en varios CSV: ${memberState}`);
      states.add(memberState);
      mergeMissing(missingValues, memberMissing);
      members.push({ member: entry.fileName, entidad_clave: memberState, rows: memberRows, sha256: hash.digest('hex'), ...total, missing_values: memberMissing, encoding: encoding.result() });
      console.log(`${source.year} entidad ${memberState}: ${memberRows.toLocaleString('en-US')} filas verificadas`);
    }
  } finally { await closeZip(zip); }
  if (states.size !== 32 || !dictionary) throw new Error('Faltan entidades o diccionario: se requieren 32 CSV + 1 TXT');
  if (missingValues.rows !== rowCount || nameProfile.rows !== rowCount) throw new Error('El perfil de calidad no cubre todas las filas');
  for (const [column, profile] of Object.entries(missingValues.columns)) {
    if (profile.total_missing > 0) console.log(`${source.year}: ${column}, ${profile.total_missing.toLocaleString('en-US')} faltantes detectados`);
  }
  const rows = sortRows([...aggregate.values()]);
  const totals = emptyCounts();
  for (const row of rows) addCounts(totals, row);
  const sourceTotals = emptyCounts();
  for (const member of members) addCounts(sourceTotals, member as Counts);
  if (JSON.stringify(totals) !== JSON.stringify(sourceTotals)) throw new Error('Se perdieron conteos durante agregación');
  const reference: Record<string, unknown> = {};
  if (source.year === 2024) {
    const expected = { LN: 98_330_348, SV: 54_899_228, NV: 37_105_466, NS: 6_325_654 };
    const ags = emptyCounts();
    for (const row of rows.filter(row => row.entidad_clave === '01')) addCounts(ags, row);
    const expectedAgs = { LN: 1_097_171, SV: 626_084, NV: 441_222, NS: 29_865 };
    for (const field of ['LN', 'SV', 'NV', 'NS'] as const) {
      if (totals[field] !== expected[field] || ags[field] !== expectedAgs[field]) throw new Error(`2024: conteos ${field} no coinciden con manual p16`);
    }
    reference.manual_url = 'https://ine.mx/wp-content/uploads/2025/06/Manual-Conteos-Censales-2009-2024.pdf';
    reference.page = 16; reference.national_exact_match = true; reference.aguascalientes_exact_match = true;
    reference.aguascalientes = { ...ags, ...metrics(ags) };
  } else {
    const benchmark = { 2009:44.1, 2012:62.1, 2015:47.1, 2018:62.4, 2021:51.8 }[source.year];
    if (Math.round(metrics(totals).participacion_pct! * 10) / 10 !== benchmark) throw new Error(`${source.year}: participación nacional no coincide con ${benchmark}% manual p21; revisar universo y fuente, sin forzar conteos`);
    reference.manual_url = 'https://ine.mx/wp-content/uploads/2025/06/Manual-Conteos-Censales-2009-2024.pdf';
    reference.page = 21; reference.national_rounded_pct = benchmark; reference.rounded_match = true;
    reference.exact_counts_independently_verified = false;
  }
  const downloaded = await acquisition(path, source);
  return { rows, groupSourceRows, dictionary, report: {
    year: source.year, source_url: source.url, landing_url: source.landing_url,
    archive_sha256: sha, archive_filename: source.filename,
    downloaded_at: downloaded?.downloaded_at ?? null,
    download_record: downloaded,
    acquisition: downloaded ? 'download-metadata' : 'local-file-original-download-date-unknown',
    dictionary_member: dictionary.member, dictionary_sha256: dictionary.sha256,
    dictionary_encoding: dictionary.encoding,
    missing_values: missingValues, names: nameProfile,
    raw_rows: rowCount, aggregate_rows: rows.length, entities: [...states].sort(),
    observed: { sexo: [...sexes].sort(), tipo_seccion: [...types].sort(), edad_min: minAge, edad_max: maxAge, feleccion: [...dates].sort(), empty_DEL: missingValues.columns.DEL.empty },
    checks: { schema: true, nonnegative_safe_integer_counts: true, LN_equals_SV_NV_NS: true, raw_unique_keys: true, aggregate_conservation: true, complete_32_entities: true, full_column_missing_profile: true, utf8_verified: true },
    totals: { ...totals, ...metrics(totals) }, official_reference: reference,
    members: members.sort((a, b) => String(a.entidad_clave).localeCompare(String(b.entidad_clave)))
  } };
}
async function atomicWrite(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.part`;
  try { await writeFile(temp, data); await rename(temp, path); }
  finally { await rm(temp, { force: true }); }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(`node scripts/ccpc/inspect-data.ts [--year all|${CCPC_YEARS.join('|')}] [--zip-<año> PATH] [--output DIR] [--sample]\nSalida default: data/ccpc/processed. --sample requiere los seis cortes y escribe fixture pequeño en data/ccpc/sample.`); return;
  }
  const options: Record<string, string> = {}; let sample = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sample') { if (sample) throw new Error('--sample repetido'); sample = true; continue; }
    if (!['--year',...CCPC_YEARS.map(year => `--zip-${year}`),'--output'].includes(args[i]) || !args[i+1] || args[i+1].startsWith('--')) throw new Error(`Argumento inválido: ${args[i]}`);
    if (args[i] in options) throw new Error(`Argumento repetido: ${args[i]}`);
    options[args[i]] = args[++i];
  }
  const year = parseSelectedYear(options['--year'] ?? 'all');
  if (sample && year !== 'all') throw new Error('--sample requiere --year all para no reemplazar fixture por menos de seis cortes');
  const sources = validateCatalog(JSON.parse(await readFile(join(ROOT,'data/ccpc/sources.json'),'utf8')), year);
  const out = options['--output'] ? resolve(options['--output']) : join(ROOT,'data/ccpc/processed');
  const fixtureRelative = relative(join(ROOT,'data/ccpc/sample'), out);
  if (fixtureRelative === '' || (!isAbsolute(fixtureRelative) && fixtureRelative !== '..' && !fixtureRelative.startsWith(`..${sep}`))) {
    throw new Error('--output no puede publicar datos completos dentro de data/ccpc/sample');
  }
  const processed: Awaited<ReturnType<typeof inspectArchive>>[] = [];
  for (const source of sources) {
    const path = options[`--zip-${source.year}`] ? resolve(options[`--zip-${source.year}`]) : join(ROOT,'data/ccpc/raw',source.filename);
    processed.push(await inspectArchive(source, path));
  }
  const rows = sortRows(processed.flatMap(result => result.rows));
  const csv = toCsv(rows);
  const nameComparison = compareEntityNames(processed.map(result => ({ year: result.report.year, names: result.report.names })));
  if (nameComparison.within_year_conflicts.length > 0) throw new Error('Nombres originales contradictorios dentro del mismo año; revisar perfil de nombres');
  for (const change of nameComparison.changes) console.log(`Nombres entre años: entidad ${change.entidad_clave}, ${JSON.stringify(change.names_by_year)}`);
  const report = { schema_version: 1, inspected_at: new Date().toISOString(), scope: 'entidad', group_key: ['anio','entidad_clave','sexo_codigo','grupo_edad','tipo_seccion'], age_groups: '18-19,20-24,...,95-99,100+', denominator: 'SV+NV', percentages_unit: 'percent', zero_denominator: null, aggregate_csv_sha256: createHash('sha256').update(csv).digest('hex'), sources: processed.map(result => result.report), entity_name_comparison: nameComparison };
  // Publish only after every selected archive has passed every check.
  await atomicWrite(join(out,'entidad.csv'),csv);
  await atomicWrite(join(out,'inspection.json'),JSON.stringify(report,null,2)+'\n');
  if (sample) {
    const sampleDir = join(ROOT,'data/ccpc/sample');
    const sampleRows = selectSample(rows), sampleCsv = toCsv(sampleRows);
    await atomicWrite(join(sampleDir,'entidad.csv'),sampleCsv);
    for (const result of processed) await atomicWrite(join(sampleDir,`dictionary-${result.report.year}.txt`),result.dictionary.bytes);
    const provenance = { ...report, fixture: { rows: sampleRows.length, representative_not_national_total: true, selection: 'Primera entidad ordenada disponible por año/sexo/tipo y bandas18-19,20-24,60-64,100+; añade casos NS>0 y denominador cero observados.', sha256: createHash('sha256').update(sampleCsv).digest('hex'), source: 'Agregados íntegros de grupos seleccionados: no son primeras filas crudas.' } };
    await atomicWrite(join(sampleDir,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
    const files = ['entidad.csv',...CCPC_YEARS.map(year => `dictionary-${year}.txt`),'provenance.json'];
    const lines = await Promise.all(files.map(async name => `${await hashFile(join(sampleDir,name))}  ${name}`));
    await atomicWrite(join(sampleDir,'checksums.sha256'),lines.join('\n')+'\n');
    console.log(`Fixture: ${sampleRows.length} grupos completos, ${Buffer.byteLength(sampleCsv)} bytes`);
  }
  console.log(`DATA-01 verificado: ${rows.length} agregados en ${out}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`ERROR: ${(error as Error).message}`); process.exitCode = 1; });
}
