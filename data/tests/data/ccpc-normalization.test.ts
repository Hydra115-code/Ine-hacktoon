import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { normalizeAggregateRows, selectParticipationSample, main as normalizeMain, assertFullOutputDirectory } from '../../scripts/ccpc/normalize-data.ts';
import { validateFile } from '../../scripts/ccpc/validate-data.ts';
import { canonicalJson, createManifest, checkManifest, parseJsonBytes, publishDataset, serializeDataset } from '../../scripts/ccpc/etl-io.ts';
import { normalize, key, addCounts, emptyCounts } from '../../scripts/ccpc/model.ts';
import type { Row } from '../../scripts/ccpc/model.ts';
import { ALLOWED_YEARS, ageGroup, calculateMetrics, percentagePointDifference, relativePercentageChange, entityNameForYear, officialSourceUrl, officialSourceMember } from '../../src/domain/civic/participation.ts';
import type { ParticipationSource } from '../../src/domain/civic/participation.ts';
import { parseParticipationDataset } from '../../src/schemas/civic/participation.schema.ts';

const ROOT=fileURLToPath(new URL('../../',import.meta.url)),FIXTURE=join(ROOT,'data/ccpc/sample/data02/participation.json');
async function temporary(t:{after:(f:()=>Promise<void>)=>void}) {
  const directory=await mkdtemp(join(tmpdir(),'ccpc-data02-'));
  t.after(async()=>{const absolute=resolve(directory),prefix=resolve(tmpdir())+sep+'ccpc-data02-';assert.ok(absolute.toLowerCase().startsWith(prefix.toLowerCase()));await rm(absolute,{recursive:true,force:true});});return directory;
}
function row(change:Partial<Row>={}):Row {const year=change.anio??2024,code=change.entidad_clave??'01';return {entidad_clave:code,entidad:entityNameForYear(year,code),anio:year,sexo_codigo:0,sexo:'hombre',grupo_edad:'18-19',tipo_seccion:'urbana',LN:100,SV:40,NV:50,NS:10,...change};}
function inputs(rows:Row[]) {
  const sources=new Map<string,ParticipationSource>(),weights=new Map<string,number>();
  for(const r of rows) {
    const id=`${r.anio}:${r.entidad_clave}`;
    if(!sources.has(id)) sources.set(id,{id,year:r.anio as ParticipationSource['year'],entityCode:r.entidad_clave,url:officialSourceUrl(r.anio),archiveSha256:'a'.repeat(64),member:officialSourceMember(r.anio,r.entidad_clave),memberSha256:'b'.repeat(64),dictionarySha256:'c'.repeat(64),downloadedAt:null,rawRows:0,totals:{nominalList:0,voted:0,didNotVote:0,unspecified:0}});
    const source=sources.get(id)!;source.rawRows+=3;source.totals.nominalList+=r.LN;source.totals.voted+=r.SV;source.totals.didNotVote+=r.NV;source.totals.unspecified+=r.NS;weights.set(key(r),3);
  }
  return {sources:[...sources.values()],weights};
}
function sample(rows=[row()]) {const {sources,weights}=inputs(rows);return normalizeAggregateRows(rows,sources,weights,'sample');}
function syntheticFull() {const rows=Array.from({length:32},(_,i)=>row({entidad_clave:String(i+1).padStart(2,'0')}));const {sources,weights}=inputs(rows);return normalizeAggregateRows(rows,sources,weights);}

test('aggregate before dividing; preserve NS and entity-only dimensions',()=>{
  const raw={AELEC:'2024',EDOCVE:'1',EDONOM:'AGUASCALIENTES',SEXO:'0',TIPOSEC:'U',EDAD:'18',LN:'10',SV:'8',NV:'1',NS:'1'};
  const first=normalize(raw,2024),second=normalize({...raw,EDAD:'19',LN:'100',SV:'20',NV:'60',NS:'20'},2024);assert.equal(key(first),key(second));const aggregate={...first,...emptyCounts()};addCounts(aggregate,first);addCounts(aggregate,second);
  const result=sample([aggregate]).records[0];assert.equal(result.nominalList,110);assert.equal(result.voted,28);assert.equal(result.didNotVote,61);assert.equal(result.unspecified,21);assert.equal(result.participationRate,28/110);assert.equal(result.ccpcParticipationPct,(28/89)*100);assert.notEqual(result.participationRate,(8/10+20/100)/2);
  for(const field of ['municipality','district','section','MPIOCVE','SECCION','DEL']) assert.equal(field in result,false);
});
test('six years and arrival order produce fixed canonical bytes and manifests',()=>{
  const rows=ALLOWED_YEARS.map(anio=>row({anio})),{sources,weights}=inputs(rows);const a=normalizeAggregateRows(rows,sources,weights,'sample'),b=normalizeAggregateRows([...rows].reverse(),[...sources].reverse(),new Map([...weights].reverse()),'sample');assert.deepEqual(a.years,[...ALLOWED_YEARS]);assert.equal(serializeDataset(a),serializeDataset(b));assert.deepEqual(createManifest(a,serializeDataset(a)),createManifest(b,serializeDataset(b)));assert.equal(serializeDataset(a).includes('inspected_at'),false);assert.ok(a.sources.every(source=>source.downloadedAt===null));
});
test('normalization rejects conflicting categories, missing/extra mappings and duplicates',()=>{
  const rows=[row()],{sources,weights}=inputs(rows);assert.throws(()=>normalizeAggregateRows(rows,sources,new Map(),'sample'),/INVALID_SOURCE_ROWS/);assert.throws(()=>normalizeAggregateRows(rows,sources,new Map([...weights,['extra',3]]),'sample'),/INVALID_RAW_MAPPING/);assert.throws(()=>normalizeAggregateRows([row({sexo_codigo:1})],sources,weights,'sample'),/INVALID_RAW_MAPPING/);assert.throws(()=>normalizeAggregateRows([{...row(),anio:2010}],sources,weights,'sample'),/INVALID_RAW_MAPPING/);assert.throws(()=>sample([row(),row()]),/DUPLICATE_COMBINATION/);assert.throws(()=>sample([row({LN:101})]),/COUNT_PARTITION_MISMATCH/);
});
test('exact sourceRows and NS zero/null cases are retained',()=>{
  const zero=sample([row({LN:0,SV:0,NV:0,NS:0})]).records[0];assert.equal(zero.sourceRows,3);assert.equal(zero.participationRate,null);const ns=sample([row({LN:10,SV:0,NV:0,NS:10})]).records[0];assert.equal(ns.unspecified,10);assert.equal(ns.unspecifiedPct,100);assert.equal(ns.ccpcParticipationPct,null);assert.equal(ns.participationPct,0);
});
test('sample selector requires validated full data and retains complete selected groups',()=>{
  const full=syntheticFull(),selected=selectParticipationSample(full);assert.equal(selected.kind,'sample');assert.equal(selected.records.length,1);assert.deepEqual(selected.records[0],full.records[0]);assert.equal(canonicalJson(selectParticipationSample(structuredClone(full))),canonicalJson(selected));assert.throws(()=>selectParticipationSample({...full,kind:'sample'}),/INVALID_KIND/);assert.throws(()=>selectParticipationSample({...full,records:[...full.records].reverse()}),/INVALID_RECORD_ORDER/);
});
test('age and percentage comparisons preserve explicit units and endpoints',()=>{
  for(const [age,band] of [[18,'18-19'],[19,'18-19'],[20,'20-24'],[24,'20-24'],[25,'25-29'],[99,'95-99'],[100,'100+'],[140,'100+']] as const) assert.equal(ageGroup(age),band);for(const age of [17,18.5,NaN,Infinity]) assert.throws(()=>ageGroup(age),/INVALID_AGE/);assert.equal(percentagePointDifference(60,50),10);assert.equal(relativePercentageChange(60,50),20);assert.equal(relativePercentageChange(60,0),null);assert.equal(percentagePointDifference(0,100),-100);for(const bad of [-1,101,NaN,Infinity]) assert.throws(()=>percentagePointDifference(bad,50),/INVALID_PERCENTAGE/);
});
test('publication validates before I/O; a held lock preserves previous bytes',async t=>{
  const directory=await temporary(t),fresh=join(directory,'invalid'),dataset=sample();await assert.rejects(publishDataset(fresh,{...dataset,records:[]}),/INVALID_ARRAY/);await assert.rejects(readdir(fresh),{code:'ENOENT'});await publishDataset(directory,dataset);const before=await readFile(join(directory,'participation.json'));await publishDataset(directory,dataset);assert.deepEqual(await readFile(join(directory,'participation.json')),before);await writeFile(join(directory,'.ccpc-etl.lock'),'another writer');await assert.rejects(publishDataset(directory,dataset),/OUTPUT_LOCKED/);assert.deepEqual(await readFile(join(directory,'participation.json')),before);assert.equal(await readFile(join(directory,'.ccpc-etl.lock'),'utf8'),'another writer');
});
test('bad CLI/ZIP inputs and full output inside fixture fail without replacing files',async t=>{
  const directory=await temporary(t);await writeFile(join(directory,'participation.json'),'sentinel');await assert.rejects(normalizeMain(['--year','2010','--output',directory]),/2009/);await assert.rejects(normalizeMain(['--year','2009','--sample','--output',directory]),/INVALID_ARGUMENT/);const zip=join(directory,'bad.zip');await writeFile(zip,'not a zip');await assert.rejects(normalizeMain(['--year','2009','--zip-2009',zip,'--output',directory]),/SHA-256/);assert.equal(await readFile(join(directory,'participation.json'),'utf8'),'sentinel');assert.throws(()=>assertFullOutputDirectory(join(ROOT,'data/ccpc/sample')),/SAMPLE_OUTPUT_FORBIDDEN/);assert.throws(()=>assertFullOutputDirectory(join(ROOT,'data/ccpc/sample/nested')),/SAMPLE_OUTPUT_FORBIDDEN/);
});
test('directory output targets are rejected without deleting existing content',async t=>{
  const directory=await temporary(t);await mkdir(join(directory,'participation.json'));await writeFile(join(directory,'participation.json','keep.txt'),'keep');await assert.rejects(publishDataset(directory,sample()),/INVALID_OUTPUT_TARGET/);assert.equal(await readFile(join(directory,'participation.json','keep.txt'),'utf8'),'keep');assert.deepEqual((await readdir(directory)).sort(),['participation.json']);
});
test('malformed bytes/JSON and altered manifest fail explicitly',()=>{
  assert.throws(()=>parseJsonBytes(Buffer.from([0xff]),'bad'),/INVALID_ENCODING/);assert.throws(()=>parseJsonBytes(Buffer.from('{'),'bad'),/INVALID_JSON/);const dataset=sample(),bytes=serializeDataset(dataset),manifest=createManifest(dataset,bytes);checkManifest(dataset,bytes,manifest);assert.throws(()=>checkManifest(dataset,bytes,{...manifest,recordCount:999}),/MANIFEST_MISMATCH/);
});
test('actual reduced fixture validates all six years, 150 groups, units and provenance',async()=>{
  const dataset=await validateFile(FIXTURE);assert.equal(dataset.kind,'sample');assert.deepEqual(dataset.years,[...ALLOWED_YEARS]);assert.equal(dataset.records.length,150);const expected=[24,25,24,24,24,29];ALLOWED_YEARS.forEach((year,i)=>assert.equal(dataset.records.filter(row=>row.year===year).length,expected[i]));assert.ok(dataset.records.some(row=>row.sex==='no_binario'&&row.year===2024));assert.ok(dataset.records.some(row=>row.unspecified>0));assert.equal(dataset.metricDefinitions.rateUnit,'ratio');assert.equal(dataset.metricDefinitions.percentageUnit,'percent');assert.equal(dataset.metricDefinitions.comparisonUnit,'percentage_point');for(const source of dataset.sources) assert.equal(source.url,officialSourceUrl(source.year));
});
test('balanced SV/NV alterations with regenerated metrics and hashes fail external reference and CLI',async t=>{
  const directory=await temporary(t),changed=structuredClone(await validateFile(FIXTURE));const first=changed.records[0],second=changed.records.find(row=>row.sourceId===first.sourceId&&row!==first&&row.voted>1)!;assert.ok(second&&first.didNotVote>1);first.voted++;first.didNotVote--;second.voted--;second.didNotVote++;Object.assign(first,calculateMetrics(first));Object.assign(second,calculateMetrics(second));parseParticipationDataset(changed);await publishDataset(directory,changed);await assert.rejects(validateFile(join(directory,'participation.json')),/REFERENCE_RECORD_MISMATCH/);const cli=spawnSync(process.execPath,[join(ROOT,'scripts/ccpc/validate-data.ts'),'--input',join(directory,'participation.json')],{encoding:'utf8'});assert.equal(cli.status,1);assert.match(cli.stderr,/REFERENCE_RECORD_MISMATCH/);assert.doesNotMatch(cli.stdout,/VALIDADO/);
});
test('compensated sourceRows and coherent source metadata alterations fail',async t=>{
  const directory=await temporary(t),original=await validateFile(FIXTURE),weights=structuredClone(original);const first=weights.records[0],second=weights.records.find(row=>row.sourceId===first.sourceId&&row!==first&&row.sourceRows>1)!;assert.ok(second);first.sourceRows++;second.sourceRows--;parseParticipationDataset(weights);await publishDataset(directory,weights);await assert.rejects(validateFile(join(directory,'participation.json')),/SOURCE_ROWS_REFERENCE_MISMATCH/);const metadata=structuredClone(original);for(const source of metadata.sources) source.memberSha256='0'.repeat(64);parseParticipationDataset(metadata);await publishDataset(directory,metadata);await assert.rejects(validateFile(join(directory,'participation.json')),/TRUSTED_SOURCE_MISMATCH/);
});
test('tampered checksums or a changed acquisition date cannot self-certify',async t=>{
  const directory=await temporary(t),dataset=await validateFile(FIXTURE);await publishDataset(directory,dataset);await writeFile(join(directory,'checksums.sha256'),'0'.repeat(64)+'  participation.json\n'+'0'.repeat(64)+'  manifest.json\n');await assert.rejects(validateFile(join(directory,'participation.json')),/CHECKSUM_MISMATCH/);const changed=structuredClone(dataset);for(const source of changed.sources) source.downloadedAt='2026-01-01T00:00:00.000Z';await publishDataset(directory,changed);await assert.rejects(validateFile(join(directory,'participation.json')),/TRUSTED_SOURCE_MISMATCH/);
});
test('civic implementation does not import prohibited financial domains',async()=>{
  for(const path of ['scripts/ccpc/normalize-data.ts','scripts/ccpc/validate-data.ts','scripts/ccpc/etl-io.ts','src/domain/civic/participation.ts','src/schemas/civic/participation.schema.ts']) {const text=await readFile(join(ROOT,path),'utf8');assert.doesNotMatch(text,/domain\/(?:account|analytics|anomaly|beneficiary|transaction|financial-constraints|financial-decimal)(?:\.ts|['"])/,path);}
});
