import assert from 'node:assert/strict';
import test from 'node:test';
import { ALLOWED_YEARS, METRIC_DEFINITIONS, CivicParticipationError, entityNameForYear, officialSourceUrl, officialSourceMember } from '../../src/domain/civic/participation.ts';
import type { ParticipationRecord, ParticipationSource, ParticipationDataset } from '../../src/domain/civic/participation.ts';
import { parseParticipationDataset, parseParticipationRecord, parseParticipationSource, participationSchema } from '../../src/schemas/civic/participation.schema.ts';

// Synthetic cases for runtime validation; never presented as official counts.
function record(change:Partial<ParticipationRecord>={}):ParticipationRecord {
  const year=change.year??2024, code=change.entityCode??'01';
  const counts={nominalList:100,voted:40,didNotVote:50,unspecified:10,...change};
  const classified=counts.voted+counts.didNotVote;
  const ratio=(n:number)=>counts.nominalList===0?null:n/counts.nominalList;
  const pct=(n:number)=>counts.nominalList===0?null:(n/counts.nominalList)*100;
  return {entityCode:code,entityName:entityNameForYear(year,code),year,sex:'mujer',ageGroup:'20-24',sectionType:'urbana',
    sourceId:`${year}:${code}`,sourceRows:2,...counts,classified,
    participationRate:ratio(counts.voted),abstentionRate:ratio(counts.didNotVote),unspecifiedRate:ratio(counts.unspecified),
    participationPct:pct(counts.voted),abstentionPct:pct(counts.didNotVote),unspecifiedPct:pct(counts.unspecified),
    ccpcParticipationPct:classified===0?null:(counts.voted/classified)*100,
    ccpcAbstentionPct:classified===0?null:(counts.didNotVote/classified)*100,...change};
}
function source(row=record(),change:Partial<ParticipationSource>={}):ParticipationSource {
  return {id:row.sourceId,entityCode:row.entityCode,year:row.year,url:officialSourceUrl(row.year),
    archiveSha256:'a'.repeat(64),member:officialSourceMember(row.year,row.entityCode),memberSha256:'b'.repeat(64),dictionarySha256:'c'.repeat(64),
    downloadedAt:null,rawRows:row.sourceRows,totals:{nominalList:row.nominalList,voted:row.voted,didNotVote:row.didNotVote,unspecified:row.unspecified},...change};
}
function dataset():ParticipationDataset {
  const row=record();return {schemaVersion:'ccpc-participation/v1',scope:'entity',kind:'sample',years:[2024],
    metricDefinitions:{...METRIC_DEFINITIONS},sources:[source(row)],records:[row]};
}
function full():ParticipationDataset {
  const records=Array.from({length:32},(_,i)=>record({entityCode:String(i+1).padStart(2,'0')}));
  return {...dataset(),kind:'full',records,sources:records.map(row=>source(row))};
}
function rejects(run:()=>unknown,code:string) {
  assert.throws(run,error=>{assert.ok(error instanceof CivicParticipationError);assert.equal(error.code,code);return true;});
}

test('nominal ratios and official percentages use their distinct stated universes',()=>{
  const parsed=parseParticipationRecord(record());
  assert.equal(parsed.participationRate,40/100);assert.equal(parsed.abstentionRate,50/100);assert.equal(parsed.unspecifiedRate,10/100);
  assert.equal(parsed.participationPct,40);assert.equal(parsed.abstentionPct,50);assert.equal(parsed.unspecifiedPct,10);
  assert.equal(parsed.ccpcParticipationPct,(40/90)*100);assert.equal(parsed.ccpcAbstentionPct,(50/90)*100);assert.equal(parsed.classified,90);
});
const metrics=['participationRate','abstentionRate','unspecifiedRate','participationPct','abstentionPct','unspecifiedPct','ccpcParticipationPct','ccpcAbstentionPct'] as const;
for(const field of metrics) {
  test(`${field}: required, exact formula and finite values in its own unit`,()=>{
    const baseline=record();const missing={...baseline} as Record<string,unknown>;delete missing[field];rejects(()=>parseParticipationRecord(missing),'MISSING_FIELD');
    rejects(()=>parseParticipationRecord({...baseline,[field]:baseline[field]!+0.01}),'METRIC_MISMATCH');
    for(const bad of [NaN,Infinity,-Infinity,-1,field.endsWith('Rate')?1.01:100.01,'40',null]) rejects(()=>parseParticipationRecord({...baseline,[field]:bad}),'INVALID_METRIC');
  });
}
test('even a small nonzero metric alteration fails exact validation',()=>{rejects(()=>parseParticipationRecord({...record(),participationRate:0.4+1e-13}),'METRIC_MISMATCH');});
test('LN zero and NS-only retain precise null semantics, including zero and 100 percent endpoints',()=>{
  const zero=parseParticipationRecord(record({nominalList:0,voted:0,didNotVote:0,unspecified:0}));for(const field of metrics) assert.equal(zero[field],null);
  rejects(()=>parseParticipationRecord({...zero,participationRate:0}),'ZERO_DENOMINATOR');
  const ns=parseParticipationRecord(record({nominalList:10,voted:0,didNotVote:0,unspecified:10}));
  assert.equal(ns.participationRate,0);assert.equal(ns.abstentionRate,0);assert.equal(ns.unspecifiedRate,1);assert.equal(ns.unspecifiedPct,100);assert.equal(ns.ccpcParticipationPct,null);assert.equal(ns.ccpcAbstentionPct,null);
  for(const counts of [{voted:100,didNotVote:0},{voted:0,didNotVote:100}]) {const endpoint=parseParticipationRecord(record({...counts,unspecified:0}));assert.equal(endpoint.participationPct,counts.voted);assert.equal(endpoint.abstentionPct,counts.didNotVote);}
});
for(const field of ['nominalList','voted','didNotVote','unspecified'] as const) {
  test(`${field}: negative, fractional, nonnumeric and unsafe integers fail`,()=>{
    for(const bad of [-1,0.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,'0',null]) rejects(()=>parseParticipationRecord({...record(),[field]:bad}),'INVALID_COUNT');
  });
}
test('all numerators are explicitly bounded, and counts must partition LN',()=>{
  for(const field of ['voted','didNotVote','unspecified']) rejects(()=>parseParticipationRecord({...record(),[field]:101}),'NUMERATOR_EXCEEDS_UNIVERSE');
  rejects(()=>parseParticipationRecord({...record(),nominalList:101}),'COUNT_PARTITION');rejects(()=>parseParticipationRecord({...record(),classified:91}),'COUNT_PARTITION');
  rejects(()=>parseParticipationRecord({...record(),nominalList:Number.MAX_SAFE_INTEGER,voted:Number.MAX_SAFE_INTEGER,didNotVote:1,unspecified:0}),'COUNT_OVERFLOW');
});
test('six years accepted, undocumented years and historical nonbinary rejected',()=>{
  for(const year of ALLOWED_YEARS) {assert.equal(parseParticipationRecord(record({year})).year,year);if(year!==2024) rejects(()=>parseParticipationRecord(record({year,sex:'no_binario'})),'INVALID_CATEGORY');}
  for(const year of [2010,2026,'2024']) rejects(()=>parseParticipationRecord({...record(),year}),'INVALID_CATEGORY');assert.equal(parseParticipationRecord(record({sex:'no_binario'})).sex,'no_binario');
});
test('entity codes, source names, age bands and section/sex categories are enforced',()=>{
  for(const entityCode of ['00','33','1',1,null]) rejects(()=>parseParticipationRecord({...record(),entityCode}),typeof entityCode==='string'?'INVALID_ENTITY':'INVALID_TEXT');
  rejects(()=>parseParticipationRecord({...record(),entityName:'CIUDAD INVENTADA'}),'ENTITY_NAME_MISMATCH');
  for(const entityName of ['', ' AGUASCALIENTES', 'AGUASCALIENTES\n']) rejects(()=>parseParticipationRecord({...record(),entityName}),'INVALID_TEXT');
  assert.equal(parseParticipationRecord(record({year:2018,entityCode:'09'})).entityName,'DISTRITO FEDERAL');assert.equal(parseParticipationRecord(record({year:2021,entityCode:'09'})).entityName,'CIUDAD DE MEXICO');
  for(const [field,bad] of [['ageGroup','20-25'],['sex','total'],['sectionType','U']]) rejects(()=>parseParticipationRecord({...record(),[field]:bad}),'INVALID_CATEGORY');
});
test('unknown lower geography and missing fields are rejected at every model level',()=>{
  rejects(()=>parseParticipationRecord({...record(),municipality:'001'}),'UNKNOWN_FIELD');const missing={...record()} as Record<string,unknown>;delete missing.unspecified;rejects(()=>parseParticipationRecord(missing),'MISSING_FIELD');
  rejects(()=>parseParticipationDataset({...dataset(),municipality:'001'}),'UNKNOWN_FIELD');rejects(()=>parseParticipationDataset({...dataset(),sources:[{...source(),district:1}]}),'UNKNOWN_FIELD');
  rejects(()=>parseParticipationDataset({...dataset(),sources:[{...source(),totals:{...source().totals,other:1}}]}),'UNKNOWN_FIELD');
});
test('sources require exact IDs, official yearly URL/member, hashes and real ISO dates',()=>{
  const original=source();assert.equal(parseParticipationSource(original).downloadedAt,null);rejects(()=>parseParticipationSource({...original,id:'2024:02'}),'INVALID_SOURCE_ID');
  for(const url of ['http://ine.mx/file.zip','https://ine.mx/other.zip',officialSourceUrl(2018),'https://evil.example/x.zip']) rejects(()=>parseParticipationSource({...original,url}),'INVALID_SOURCE_URL');
  for(const member of ['../file.csv','C:/file.csv',officialSourceMember(2024,'02')]) rejects(()=>parseParticipationSource({...original,member}),'INVALID_SOURCE_MEMBER');
  for(const field of ['archiveSha256','memberSha256','dictionarySha256']) for(const bad of ['', 'a'.repeat(63),'A'.repeat(64),'z'.repeat(64)]) rejects(()=>parseParticipationSource({...original,[field]:bad}),'INVALID_HASH');
  for(const downloadedAt of ['2026-02-30T00:00:00.000Z','2026-10-13','yesterday']) rejects(()=>parseParticipationSource({...original,downloadedAt}),'INVALID_DOWNLOAD_DATE');assert.equal(parseParticipationSource({...original,downloadedAt:'2026-10-13T00:00:00.000Z'}).downloadedAt,'2026-10-13T00:00:00.000Z');
});
test('complete coverage and source counts/rows are conserved',()=>{
  const value=full();assert.deepEqual(parseParticipationDataset(value),value);rejects(()=>parseParticipationDataset({...value,sources:value.sources.slice(1),records:value.records.slice(1)}),'ENTITY_COVERAGE');
  const badCount=structuredClone(value);badCount.sources[0].totals.nominalList++;badCount.sources[0].totals.unspecified++;rejects(()=>parseParticipationDataset(badCount),'COUNT_CONSERVATION');
  const badRows=structuredClone(value);badRows.sources[0].rawRows++;rejects(()=>parseParticipationDataset(badRows),'ROW_CONSERVATION');
});
test('duplicates use dimensions alone; empty arrays and mismatched provenance fail',()=>{
  const value=dataset();rejects(()=>parseParticipationDataset({...value,records:[record(),record()]}),'DUPLICATE_COMBINATION');rejects(()=>parseParticipationDataset({...value,records:[]}),'INVALID_ARRAY');
  rejects(()=>parseParticipationDataset({...value,sources:[source(),source()]}),'DUPLICATE_SOURCE');rejects(()=>parseParticipationRecord({...record(),sourceId:'2024:02'}),'INVALID_SOURCE_ID');
  rejects(()=>parseParticipationDataset({...value,years:[2021]}),'SOURCE_YEAR_MISMATCH');rejects(()=>parseParticipationDataset({...value,sources:[source(record({entityCode:'02'}))]}),'UNKNOWN_SOURCE');
});
test('canonical order is enforced without sorting or repairing parsed data',()=>{
  const value=full();rejects(()=>parseParticipationDataset({...value,records:[...value.records].reverse()}),'INVALID_RECORD_ORDER');rejects(()=>parseParticipationDataset({...value,sources:[...value.sources].reverse()}),'INVALID_SOURCE_ORDER');assert.equal(value.records[0].entityCode,'01');
});
test('annual metadata and sourceRows/count subsets cannot contradict themselves',()=>{
  const value=full();value.sources[1].dictionarySha256='d'.repeat(64);rejects(()=>parseParticipationDataset(value),'INCONSISTENT_ANNUAL_SOURCE');rejects(()=>parseParticipationDataset({...dataset(),records:[{...record(),sourceRows:3}]}),'SOURCE_ROWS_EXCEEDED');
  const changed=dataset();changed.sources[0].totals={nominalList:100,voted:39,didNotVote:51,unspecified:10};rejects(()=>parseParticipationDataset(changed),'COUNT_CONSERVATION');
});
test('version, scope, years and units cannot drift; safeParse returns an explicit error',()=>{
  rejects(()=>parseParticipationDataset({...dataset(),scope:'section'}),'INVALID_SCOPE');rejects(()=>parseParticipationDataset({...dataset(),schemaVersion:'v0'}),'INVALID_SCHEMA_VERSION');rejects(()=>parseParticipationDataset({...dataset(),years:[2024,2024]}),'INVALID_YEARS');
  rejects(()=>parseParticipationDataset({...dataset(),metricDefinitions:{...METRIC_DEFINITIONS,rateUnit:'percent'}}),'INVALID_METRIC_DEFINITION');const result=participationSchema.safeParse({...dataset(),records:[]});assert.equal(result.success,false);if(!result.success) assert.equal(result.error.code,'INVALID_ARRAY');
});
