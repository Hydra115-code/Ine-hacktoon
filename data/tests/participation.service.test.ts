import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'node:url';
import { createParticipationRepository } from '../src/repositories/participation.repository.ts';
import { createParticipationService } from '../src/services/participation.service.ts';
import {
  electionComparisonSchema, participationBreakdownSchema, participationSummarySchema, supportingRecordsSchema,
} from '../src/application/ports/participation-data.ts';
import type { BreakdownDimension, ParticipationFilters, Year } from '../src/application/ports/participation-data.ts';
import { validateFile } from '../scripts/ccpc/validate-data.ts';
import { canonicalJson, sha256 } from '../scripts/ccpc/etl-io.ts';
import type { ParticipationDataset } from '../src/domain/civic/participation.ts';

const dataset=await validateFile(fileURLToPath(new URL('../data/ccpc/sample/data02/participation.json',import.meta.url)));
const csv= parse(await readFile(new URL('../data/ccpc/sample/entidad.csv',import.meta.url)),{columns:true}) as Array<Record<string,string>>;
const service=createParticipationService(createParticipationRepository(dataset));
const filters:ParticipationFilters={year:2024,entityCodes:['01'],sexes:['hombre'],ageGroups:['18-19'],sectionTypes:['urbana']};
const expected=(year:number)=>csv.find(row=>Number(row.anio)===year && row.entidad_clave==='01' && row.sexo==='hombre' && row.grupo_edad==='18-19' && row.tipo_seccion==='urbana')!;
const counts=(row:Record<string,string>)=>({nominalList:Number(row.LN),voted:Number(row.SV),didNotVote:Number(row.NV),unspecified:Number(row.NS)});

test('summary returns a real validated group with both universes, sources and exact contributing rows',()=>{
  const result=service.getParticipationSummary(filters);participationSummarySchema.parse(result);
  assert.equal(result.status,'ok');assert.equal(result.totals!.nominalList,14908);assert.equal(result.totals!.voted,7288);assert.equal(result.totals!.didNotVote,7297);assert.equal(result.totals!.unspecified,323);
  assert.equal(result.totals!.participationRate,7288/14908);assert.equal(result.totals!.ccpcParticipationPct,(7288/(7288+7297))*100);
  assert.equal(result.evidence.matchedRecords,1);assert.equal(result.evidence.matchedSourceRows,1025);assert.equal(result.evidence.sources[0].id,'2024:01');
  assert.equal(result.evidence.sources[0].archiveSha256,'c0de34d04e782ad99579b83591a6e3e6c8d1e20f4914d4845743bd79d2bd28b2');
  assert.ok(result.warnings.some(w=>w.code==='SAMPLE_DATA'));assert.ok(result.warnings.some(w=>w.code==='NS_EXCLUDED_FROM_CCPC'));
  assert.equal(result.evidence.dataset.validation,'runtime_schema');
});
test('summary sums selected counts first, then recalculates rates instead of averaging percentages',()=>{
  const result=service.getParticipationSummary({year:2024,entityCodes:['01'],sexes:['hombre'],ageGroups:['18-19','20-24'],sectionTypes:['urbana']});
  const selected=csv.filter(row=>row.anio==='2024'&&row.entidad_clave==='01'&&row.sexo==='hombre'&&['18-19','20-24'].includes(row.grupo_edad)&&row.tipo_seccion==='urbana');
  const ln=selected.reduce((sum,r)=>sum+Number(r.LN),0),sv=selected.reduce((sum,r)=>sum+Number(r.SV),0);
  assert.equal(result.totals!.nominalList,ln);assert.equal(result.totals!.voted,sv);assert.equal(result.totals!.participationRate,sv/ln);
  assert.notEqual(result.totals!.participationRate,selected.reduce((sum,r)=>sum+Number(r.SV)/Number(r.LN),0)/selected.length);
});
test('default year is explicit and never pools different elections',()=>{
  const result=service.getParticipationSummary({entityCodes:['01']});assert.equal(result.filters.year,2024);assert.ok(result.warnings.some(w=>w.code==='DEFAULT_YEAR_SELECTED'));
  assert.ok(result.evidence.sources.every(source=>source.year===2024));assert.deepEqual(result.evidence.catalogSources.map(s=>s.year),[2024]);
  assert.equal(service.getSupportingRecords({entityCodes:['01']}).filters.year,2024);
});
test('comparison is chronological with separate yearly totals, pp and relative percentages',()=>{
  const {year:_,...cohort}=filters;
  const result=service.compareElections(cohort,[2024,2018]);electionComparisonSchema.parse(result);
  assert.deepEqual(result.years,[2018,2024]);assert.equal(result.baselineYear,2018);assert.equal(result.elections.length,2);assert.equal(result.changes.length,1);
  const old=counts(expected(2018)),now=counts(expected(2024));const a=(old.voted/old.nominalList)*100,b=(now.voted/now.nominalList)*100;
  assert.equal(result.elections[0].summary.totals!.voted,old.voted);assert.equal(result.elections[1].summary.totals!.voted,now.voted);
  assert.equal(result.changes[0].participationPercentagePoints,b-a);assert.equal(result.changes[0].participationRelativePercent,((b-a)/a)*100);
  assert.equal(result.changes[0].ccpcParticipationPercentagePoints,(now.voted/(now.voted+now.didNotVote))*100-(old.voted/(old.voted+old.didNotVote))*100);
  assert.notEqual(result.changes[0].participationPercentagePoints,result.changes[0].participationRelativePercent);
  assert.ok(result.warnings.some(w=>w.code==='CARTOGRAPHIC_FRAMES_DIFFER'));assert.ok(result.warnings.some(w=>w.code==='ELECTIONS_NOT_A_PANEL'));assert.ok(result.warnings.some(w=>w.code==='SECTION_TYPES_MAY_CHANGE'));
});
for(const dimension of ['entity','year','sex','ageGroup','sectionType'] as const) {
  test(`breakdown ${dimension} conserves counts and evidence in deterministic groups`,()=>{
    const filters={year:2024 as const},result=service.getParticipationBreakdown(filters,dimension),total=service.getParticipationSummary(filters);
    participationBreakdownSchema.parse(result);assert.equal(result.status,'ok');
    for(const field of ['nominalList','voted','didNotVote','unspecified'] as const) assert.equal(result.groups.reduce((sum,g)=>sum+g.summary.totals![field],0),total.totals![field]);
    assert.equal(result.groups.reduce((sum,g)=>sum+g.summary.evidence.matchedRecords,0),result.evidence.matchedRecords);
    assert.equal(result.groups.reduce((sum,g)=>sum+g.summary.evidence.matchedSourceRows,0),result.evidence.matchedSourceRows);
    for(const group of result.groups) assert.ok(group.summary.evidence.sources.length);
    if(dimension==='year') assert.deepEqual(result.groups.map(g=>g.value),['2024']);
    if(dimension==='sex') assert.deepEqual(result.groups.map(g=>g.value),['hombre','mujer','no_binario']);
  });
}
test('supporting records are the exact counted evidence with a reproducible digest',()=>{
  const support=service.getSupportingRecords(filters),summary=service.getParticipationSummary(filters);supportingRecordsSchema.parse(support);
  assert.equal(support.records.length,1);assert.deepEqual(counts(expected(2024)),Object.fromEntries(['nominalList','voted','didNotVote','unspecified'].map(field=>[field,support.records[0][field as 'nominalList']])));
  assert.equal(support.records[0].sourceRows,1025);assert.equal(support.evidence.recordsSha256,sha256(canonicalJson(support.records)));assert.equal(summary.evidence.recordsSha256,support.evidence.recordsSha256);
  assert.deepEqual(support.evidence.contributions,[{sourceId:'2024:01',records:1,sourceRows:1025}]);
});
test('missing historical sex data remains no_data/null with official source context',()=>{
  const filters={year:2018 as const,sexes:['no_binario'] as const};const summary=service.getParticipationSummary(filters),support=service.getSupportingRecords(filters),breakdown=service.getParticipationBreakdown(filters,'ageGroup');
  assert.equal(summary.status,'no_data');assert.equal(summary.totals,null);assert.equal(summary.evidence.matchedRecords,0);assert.ok(summary.evidence.sources.length);
  assert.ok(summary.warnings.some(w=>w.code==='NON_BINARY_UNAVAILABLE'));assert.equal(support.records.length,0);assert.equal(breakdown.groups.length,0);
  const compare=service.compareElections({sexes:['no_binario']},[2018,2024]);assert.equal(compare.elections[0].summary.totals,null);assert.equal(compare.changes[0].participationPercentagePoints,null);assert.equal(compare.changes[0].participationRelativePercent,null);
});
test('a year missing from the loaded dataset has a catalog citation without fabricated source hashes',()=>{
  const partial:ParticipationDataset={...structuredClone(dataset),years:[2024],sources:dataset.sources.filter(s=>s.year===2024),records:dataset.records.filter(r=>r.year===2024)};
  const result=createParticipationService(createParticipationRepository(partial)).getParticipationSummary({year:2009});
  assert.equal(result.totals,null);assert.equal(result.evidence.sources.length,0);assert.equal(result.evidence.catalogSources[0].year,2009);assert.ok(result.warnings.some(w=>w.code==='YEAR_NOT_AVAILABLE'));
});
test('observed zero LN is different from absent records and preserves null metric semantics',()=>{
  const source=dataset.sources.find(s=>s.year===2024&&s.entityCode==='01')!,base=dataset.records.find(r=>r.sourceId===source.id)!;
  // Synthetic boundary case, never claimed to be an observed official zero cell.
  const zero={...base,nominalList:0,voted:0,didNotVote:0,unspecified:0,classified:0,sourceRows:1,participationRate:null,abstentionRate:null,unspecifiedRate:null,participationPct:null,abstentionPct:null,unspecifiedPct:null,ccpcParticipationPct:null,ccpcAbstentionPct:null};
  const synthetic:ParticipationDataset={...dataset,years:[2024],sources:[source],records:[zero]};
  const result=createParticipationService(createParticipationRepository(synthetic)).getParticipationSummary({year:2024});
  assert.equal(result.status,'ok');assert.equal(result.totals!.nominalList,0);assert.equal(result.totals!.participationPct,null);assert.equal(result.totals!.ccpcParticipationPct,null);
});
test('filters, year lists and unsupported breakdown dimensions fail explicitly',()=>{
  for(const bad of [{year:'2024'},{entityCodes:['00']},{sexes:[]},{sexes:['mujer','mujer']},{municipality:'001'}]) assert.throws(()=>service.getParticipationSummary(bad as never));
  for(const years of [[2024],[2024,2024],[2010,2024],[2018,,2024]]) assert.throws(()=>service.compareElections({},years as Year[]),/INVALID_COMPARISON_YEARS/);
  assert.throws(()=>service.compareElections({year:2018},[2018,2024]),/CONFLICTING_YEAR_FILTER/);assert.throws(()=>service.getParticipationBreakdown({},'municipality' as BreakdownDimension),/INVALID_BREAKDOWN_DIMENSION/);
});
test('outputs and input objects are isolated and all four methods are deterministic',()=>{
  const input={year:2024 as const,entityCodes:['01','02'] as const},before=JSON.stringify(input);
  const calls=[()=>service.getParticipationSummary(input),()=>service.compareElections({entityCodes:['01']},[2009,2018,2024]),()=>service.getParticipationBreakdown(input,'sex'),()=>service.getSupportingRecords(input)];
  for(const call of calls) {const first=call(),bytes=canonicalJson(first);first.evidence.dataset.years.pop();first.evidence.sources[0].totals.voted=0;assert.equal(canonicalJson(call()),bytes);}
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(service.getParticipationSummary({year:2024,entityCodes:['02','01']}),service.getParticipationSummary({year:2024,entityCodes:['01','02']}));
});
test('Zod output schemas reject stale metrics, missing sources, invalid changes and unknown fields',()=>{
  const summary=service.getParticipationSummary(filters);assert.equal(participationSummarySchema.safeParse({...summary,unknown:true}).success,false);
  assert.equal(participationSummarySchema.safeParse({...summary,units:{...summary.units,rateUnit:'percent'}}).success,false);
  assert.equal(participationSummarySchema.safeParse({...summary,totals:{...summary.totals!,participationRate:0.99}}).success,false);
  assert.equal(participationSummarySchema.safeParse({...summary,evidence:{...summary.evidence,sources:[]}}).success,false);
  const compare=service.compareElections({},[2018,2024]);compare.changes[0].participationPercentagePoints=999;assert.equal(electionComparisonSchema.safeParse(compare).success,false);
  const support=service.getSupportingRecords(filters);support.records[0].year=2018;assert.equal(supportingRecordsSchema.safeParse(support).success,false);
});
test('production query files have no Gemini, network, filesystem, clock or random dependency',async()=>{
  for(const path of ['src/repositories/participation.repository.ts','src/services/participation.service.ts','src/application/ports/participation-data.ts']) {
    const source=await readFile(new URL('../'+path,import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"](?:node:fs|node:http|node:https|@google|@ai-sdk|openai|gemini)/);
    assert.doesNotMatch(source,/\bfetch\s*\(|Date\.now\s*\(|new Date\s*\(|Math\.random\s*\(/);
  }
});
