/** Optional filesystem adapter; the repository and service themselves remain pure. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256 } from './etl-io.ts';
import { validateFile } from './validate-data.ts';
import { CivicParticipationError } from '../../src/domain/civic/participation.ts';
import { createParticipationRepository } from '../../src/repositories/participation.repository.ts';
import { createParticipationService } from '../../src/services/participation.service.ts';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export async function main(args=process.argv.slice(2)):Promise<void> {
  if(args.includes('--help')) { console.log('node scripts/ccpc/query-examples.ts [--input PATH] [--output DIR]\nDefault: fixture DATA02 y docs/data03-examples/sample. Valida archivos antes de crear el motor.');return; }
  const options:Record<string,string>={};
  for(let i=0;i<args.length;i++) {
    const flag=args[i];
    if(!['--input','--output'].includes(flag) || !args[i+1] || args[i+1].startsWith('--') || flag in options) throw new CivicParticipationError('INVALID_ARGUMENT',`Argumento inválido: ${flag}.`);
    options[flag]=args[++i];
  }
  const input=options['--input']?resolve(options['--input']):join(ROOT,'data/ccpc/sample/data02/participation.json');
  const dataset=await validateFile(input),service=createParticipationService(createParticipationRepository(dataset));
  const filters={year:2024,entityCodes:['01'],sexes:['hombre'],ageGroups:['18-19'],sectionTypes:['urbana']} as const;
  const comparisonFilters={entityCodes:['01'],sexes:['hombre'],ageGroups:['18-19'],sectionTypes:['urbana']} as const;
  const breakdownFilters={year:2024,entityCodes:['01'],ageGroups:['18-19']} as const;
  const examples={
    schemaVersion:'ccpc-query-examples/v1',datasetKind:dataset.kind,
    datasetSha256:sha256(await readFile(input)),
    calls:[
      {method:'getParticipationSummary',input:{filters},result:service.getParticipationSummary(filters)},
      {method:'compareElections',input:{filters:comparisonFilters,years:[2018,2024]},result:service.compareElections(comparisonFilters,[2018,2024])},
      {method:'getParticipationBreakdown',input:{filters:breakdownFilters,dimension:'sex'},result:service.getParticipationBreakdown(breakdownFilters,'sex')},
      {method:'getSupportingRecords',input:{filters},result:service.getSupportingRecords(filters)},
    ],
  };
  const output=options['--output']?resolve(options['--output']):join(ROOT,'docs/data03-examples',dataset.kind);
  await mkdir(output,{recursive:true});
  const bytes=canonicalJson(examples);
  await writeFile(join(output,'queries.json'),bytes);
  await writeFile(join(output,'checksums.sha256'),`${sha256(bytes)}  queries.json\n`);
  console.log(`DATA-03 ejemplos: ${dataset.kind}, cuatro consultas, SHA-256 ${sha256(bytes)}. Salida: ${output}`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(`ERROR: ${(error as Error).message}`);process.exitCode=1;});
}
