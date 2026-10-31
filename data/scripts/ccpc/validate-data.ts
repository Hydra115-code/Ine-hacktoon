import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { canonicalJson, checkManifest, parseJsonBytes, readJson, sha256 } from './etl-io.ts';
import { validateCatalog, validateDownloadManifest } from './validation.ts';
import { verifySourceRowDigest } from './source-row-anchors.ts';
import { CivicParticipationError, participationKey } from '../../src/domain/civic/participation.ts';
import type { ParticipationDataset, ParticipationSource } from '../../src/domain/civic/participation.ts';
import { parseParticipationDataset } from '../../src/schemas/civic/participation.schema.ts';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
// Released DATA01 source facts; excludes inspection/acquisition clocks.
const SOURCE_ANCHORS_SHA256='24b8f676d2a8ed7a05d32c1abdfcfc277f38edfc47c42e86220efc711b4fcdec';
const DATA01_HEADER=['entidad_clave','entidad','anio','sexo_codigo','sexo','grupo_edad','tipo_seccion','LN','SV','NV','NS','participacion_pct','abstencion_pct','no_especificado_pct','denominador_participacion'];
const DATA01_FILES=['entidad.csv','dictionary-2009.txt','dictionary-2012.txt','dictionary-2015.txt','dictionary-2018.txt','dictionary-2021.txt','dictionary-2024.txt','provenance.json'];
type Anchors={schemaVersion:string;aggregateCsvSha256:string;fixtureCsvSha256:string;sources:Omit<ParticipationSource,'downloadedAt'>[]};
function fail(code:string,message:string):never {throw new CivicParticipationError(code,message);}

async function trustedData01() {
  const anchorBytes=await readFile(join(ROOT,'data/ccpc/source-anchors.json'));
  if (sha256(anchorBytes)!==SOURCE_ANCHORS_SHA256) fail('SOURCE_ANCHOR_MISMATCH','Las anclas publicadas de DATA-01 fueron alteradas.');
  const anchors=parseJsonBytes(anchorBytes,'source-anchors.json') as Anchors;
  const sample=join(ROOT,'data/ccpc/sample');
  const checksums=(await readFile(join(sample,'checksums.sha256'),'utf8')).trim().split(/\r?\n/);
  const seen=new Set<string>();
  if (checksums.length!==DATA01_FILES.length) fail('DATA01_CHECKSUM_MISMATCH','Se requieren las ocho huellas originales DATA-01.');
  for (const line of checksums) {
    const matched=/^([a-f0-9]{64})  ([a-z0-9.-]+)$/.exec(line);
    if (!matched || !DATA01_FILES.includes(matched[2]) || seen.has(matched[2])) fail('DATA01_CHECKSUM_MISMATCH','Listado de huellas DATA-01 inválido.');
    seen.add(matched[2]);
    if (sha256(await readFile(join(sample,matched[2])))!==matched[1]) fail('DATA01_CHECKSUM_MISMATCH',`SHA-256 DATA-01 distinto: ${matched[2]}.`);
  }
  const provenance=await readJson(join(sample,'provenance.json')) as {aggregate_csv_sha256:string;fixture:{sha256:string};sources:Array<{year:number;source_url:string;archive_sha256:string;dictionary_sha256:string;downloaded_at:string|null;download_record:unknown;members:Array<{member:string;entidad_clave:string;sha256:string;rows:number;LN:number;SV:number;NV:number;NS:number}>}>};
  if (provenance.aggregate_csv_sha256!==anchors.aggregateCsvSha256 || provenance.fixture.sha256!==anchors.fixtureCsvSha256) fail('DATA01_REFERENCE_MISMATCH','La procedencia DATA-01 no corresponde a los conteos de la publicación fijada.');
  if (provenance.sources.length!==6 || new Set(provenance.sources.map(source=>source.year)).size!==6 || provenance.sources.some(source=>source.members.length!==32 || new Set(source.members.map(member=>member.entidad_clave)).size!==32)) fail('TRUSTED_SOURCE_MISMATCH','La procedencia DATA-01 necesita seis años únicos y 32 miembros únicos por año.');
  if (sha256(await readFile(join(sample,'entidad.csv')))!==anchors.fixtureCsvSha256) fail('DATA01_REFERENCE_MISMATCH','El fixture CSV DATA-01 fue alterado.');
  for (const annual of provenance.sources) {
    const expected=anchors.sources.find(source=>source.year===annual.year);
    if (!expected || sha256(await readFile(join(sample,`dictionary-${annual.year}.txt`)))!==expected.dictionarySha256) fail('TRUSTED_SOURCE_MISMATCH','Los bytes de diccionario difieren del SHA-256 publicado.');
    if (annual.download_record!==null) {
      const acquisition=validateDownloadManifest({schema_version:1,downloads:[annual.download_record]}).downloads[0];
      if (acquisition.year!==annual.year || acquisition.url!==expected.url || acquisition.sha256!==expected.archiveSha256 || acquisition.downloaded_at!==annual.downloaded_at) fail('TRUSTED_SOURCE_MISMATCH','La fecha de procedencia contradice el registro de adquisición.');
    } else if (annual.downloaded_at!==null) fail('TRUSTED_SOURCE_MISMATCH','Una fecha conocida requiere registro de adquisición.');
  }
  const dates=new Map<string,string|null>();
  for (const expected of anchors.sources) {
    const annual=provenance.sources.find(source=>source.year===expected.year);
    const member=annual?.members.find(item=>item.entidad_clave===expected.entityCode);
    if (!annual || !member) fail('TRUSTED_SOURCE_MISMATCH',`Falta procedencia DATA-01 para ${expected.id}.`);
    const observed={id:expected.id,year:annual.year,entityCode:member.entidad_clave,url:annual.source_url,
      archiveSha256:annual.archive_sha256,member:member.member,memberSha256:member.sha256,
      dictionarySha256:annual.dictionary_sha256,rawRows:member.rows,
      totals:{nominalList:member.LN,voted:member.SV,didNotVote:member.NV,unspecified:member.NS}};
    if (canonicalJson(observed)!==canonicalJson(expected)) fail('TRUSTED_SOURCE_MISMATCH',`Los hechos de origen DATA-01 cambiaron para ${expected.id}.`);
    dates.set(expected.id,annual.downloaded_at);
  }
  return {anchors,dates};
}

async function checkData02Checksums(input:string,manifestPath:string):Promise<void> {
  const listing=(await readFile(join(dirname(input),'checksums.sha256'),'utf8')).trim().split(/\r?\n/);
  if (listing.length!==2) fail('CHECKSUM_MISMATCH','Se requieren las huellas de datos y manifiesto DATA-02.');
  const expected={ 'participation.json':sha256(await readFile(input)), 'manifest.json':sha256(await readFile(manifestPath)) };
  const seen=new Set<string>();
  for (const line of listing) {
    const matched=/^([a-f0-9]{64})  (participation\.json|manifest\.json)$/.exec(line);
    if (!matched || seen.has(matched[2]) || expected[matched[2] as keyof typeof expected]!==matched[1]) fail('CHECKSUM_MISMATCH','Las huellas DATA-02 no corresponden a los bytes.');
    seen.add(matched[2]);
  }
}

/** Contrasta con un origen externo fijado; un manifiesto DATA02 no se autoacredita. */
export async function validateFile(input:string,manifestPath=join(dirname(input),'manifest.json'),referencePath?:string):Promise<ParticipationDataset> {
  const bytes=await readFile(input);
  const dataset=parseParticipationDataset(parseJsonBytes(bytes,input));
  checkManifest(dataset,bytes,await readJson(manifestPath));
  await checkData02Checksums(input,manifestPath);
  const catalog=validateCatalog(await readJson(join(ROOT,'data/ccpc/sources.json')),'all');
  for (const source of dataset.sources) {
    const official=catalog.find(item=>item.year===source.year)!;
    if (source.url!==official.url || source.archiveSha256!==official.sha256) fail('SOURCE_CATALOG_MISMATCH',`Fuente ${source.id} distinta del catálogo oficial.`);
  }
  const {anchors,dates}=await trustedData01();
  for (const source of dataset.sources) {
    const {downloadedAt,...facts}=source;
    const expected=anchors.sources.find(item=>item.id===source.id);
    if (canonicalJson(facts)!==canonicalJson(expected)) fail('TRUSTED_SOURCE_MISMATCH',`Procedencia ${source.id} distinta de los hechos originales.`);
    // Unknown acquisition remains unknown. Never manufacture a date for a local ZIP.
    if (downloadedAt!==null && downloadedAt!==dates.get(source.id)) fail('TRUSTED_SOURCE_MISMATCH',`Fecha conocida sin correspondencia de adquisición para ${source.id}.`);
  }
  const reference=referencePath ?? join(ROOT,dataset.kind==='full'?'data/ccpc/processed/entidad.csv':'data/ccpc/sample/entidad.csv');
  const referenceBytes=await readFile(reference).catch(error=>{
    if(error.code==='ENOENT') fail('REFERENCE_NOT_FOUND',`Falta la referencia DATA-01: ${reference}. Ejecute ccpc:inspect -- --year all --sample.`);
    throw error;
  });
  const expectedHash=dataset.kind==='full'?anchors.aggregateCsvSha256:anchors.fixtureCsvSha256;
  if(sha256(referenceBytes)!==expectedHash) fail('REFERENCE_HASH_MISMATCH','La referencia no coincide con el SHA-256 independiente de DATA-01.');
  const rows=parse(referenceBytes,{bom:true,columns:(header:string[])=>{
    if(header.join(',')!==DATA01_HEADER.join(',')) fail('REFERENCE_SCHEMA_MISMATCH','Columnas DATA-01 incorrectas.');
    return header;
  }}) as Array<Record<string,string>>;
  const referenceRecords=new Map(rows.filter(row=>dataset.years.includes(Number(row.anio) as ParticipationSource['year'])).map(row=>[
    [row.anio,row.entidad_clave,row.sexo,row.grupo_edad,row.tipo_seccion].join('|'),row
  ]));
  if(referenceRecords.size!==dataset.records.length) fail('REFERENCE_RECORD_MISMATCH','La cobertura de grupos difiere de la referencia DATA-01.');
  for(const record of dataset.records) {
    const original=referenceRecords.get(participationKey(record));
    if(!original || record.entityName!==original.entidad ||
      record.nominalList!==Number(original.LN) || record.voted!==Number(original.SV) ||
      record.didNotVote!==Number(original.NV) || record.unspecified!==Number(original.NS)) {
      fail('REFERENCE_RECORD_MISMATCH',`Conteos o dimensiones diferentes del origen: ${participationKey(record)}.`);
    }
  }
  verifySourceRowDigest(dataset);
  return dataset;
}

export async function main(args=process.argv.slice(2)):Promise<void> {
  if(args.includes('--help')) {
    console.log('node scripts/ccpc/validate-data.ts [--input PATH] [--manifest PATH] [--reference PATH]\nDefault: data/ccpc/processed/data02/participation.json. Referencia DATA-01 verificada por SHA-256.');return;
  }
  const options:Record<string,string>={};
  for(let i=0;i<args.length;i++) {
    const flag=args[i];
    if(!['--input','--manifest','--reference'].includes(flag) || !args[i+1] || args[i+1].startsWith('--') || flag in options) fail('INVALID_ARGUMENT',`Argumento inválido o repetido: ${flag}.`);
    options[flag]=args[++i];
  }
  const input=options['--input']?resolve(options['--input']):join(ROOT,'data/ccpc/processed/data02/participation.json');
  const dataset=await validateFile(input,options['--manifest']?resolve(options['--manifest']):undefined,options['--reference']?resolve(options['--reference']):undefined);
  console.log(`VALIDADO: ${dataset.kind}, ${dataset.records.length} grupos, años ${dataset.years.join(',')}; fórmulas, conteos, procedencia y referencias de origen correctos.`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(`ERROR: ${(error as Error).message}`);process.exitCode=1;});
}
