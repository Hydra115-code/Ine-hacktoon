import test from 'node:test';
import assert from 'node:assert/strict';
import { ageGroup, normalize, counts, emptyCounts, addCounts, metrics, selectSample, key } from '../scripts/ccpc/model.ts';
import { CCPC_YEARS } from '../scripts/ccpc/years.ts';

test('límites oficiales y edades altas preservadas en100+', () => {
  for (const [age, group] of [[18,'18-19'],[19,'18-19'],[20,'20-24'],[24,'20-24'],[25,'25-29'],[85,'85-89'],[99,'95-99'],[100,'100+'],[140,'100+']] as const) assert.equal(ageGroup(age),group);
  assert.throws(() => ageGroup(17)); assert.throws(() => ageGroup(20.5));
});
test('NS excluido del denominador; agrega conteos antes de dividir', () => {
  const total = emptyCounts(); addCounts(total,{LN:110,SV:90,NV:10,NS:10}); addCounts(total,{LN:30,SV:1,NV:9,NS:20});
  assert.equal(metrics(total).participacion_pct,100*91/110);
  assert.equal(metrics(total).no_especificado_pct,100*30/140);
  assert.notEqual(metrics(total).participacion_pct,(90+10)/2);
  assert.equal(metrics({LN:5,SV:0,NV:0,NS:5}).participacion_pct,null);
  assert.equal(metrics(emptyCounts()).no_especificado_pct,null);
});
test('no aceptar conteos negativos, decimales, vacíos o inconsistentes', () => {
  for (const SV of ['-1','1.5','', '9007199254740992']) assert.throws(() => counts({LN:'10',SV,NV:'0',NS:'0'}));
  assert.throws(() => counts({LN:'10',SV:'5',NV:'4',NS:'0'}));
  assert.throws(() => addCounts({LN:Number.MAX_SAFE_INTEGER,SV:0,NV:0,NS:0},{LN:1,SV:0,NV:0,NS:0}));
});
test('sexo y año por diccionario; salida sólo entidad', () => {
  const raw={AELEC:'2024',EDOCVE:'1',EDONOM:'AGUASCALIENTES',EDAD:'20',TIPOSEC:'U',SEXO:'2',LN:'2',SV:'1',NV:'0',NS:'1'};
  const row=normalize(raw,2024);
  assert.equal(row.sexo,'no_binario'); assert.equal(row.entidad_clave,'01');
  assert.equal('SECCION' in row,false); assert.throws(() => normalize(raw,2018));
  assert.throws(() => normalize({...raw,AELEC:'2018'},2018));
  assert.throws(() => normalize({...raw,TIPOSEC:'X'},2024));
  assert.throws(() => normalize({...raw,TIPOSEC:'constructor'},2024));
  assert.throws(() => normalize({...raw,TIPOSEC:'__proto__'},2024));
  const sampled=selectSample([row]); assert.equal(sampled.length,1); assert.equal(key(sampled[0]),key(row));
});
test('los seis cortes admiten los códigos comunes; no_binario sólo en 2024', () => {
  const raw = {AELEC:'2009',EDOCVE:'32',EDONOM:'ZACATECAS',EDAD:'137',TIPOSEC:'R',SEXO:'0',LN:'10',SV:'4',NV:'5',NS:'1'};
  for (const year of CCPC_YEARS) {
    const row = normalize({...raw,AELEC:String(year)}, year);
    assert.equal(row.anio,year); assert.equal(row.grupo_edad,'100+');
    if (year !== 2024) assert.throws(() => normalize({...raw,AELEC:String(year),SEXO:'2'},year));
  }
  assert.throws(() => normalize({...raw,AELEC:'2010'},2010));
});
test('fixture independiente del orden de entrada y sin alterar los conteos', () => {
  const raw={AELEC:'2009',EDOCVE:'1',EDONOM:'AGUASCALIENTES',EDAD:'20',TIPOSEC:'U',SEXO:'0',LN:'10',SV:'4',NV:'5',NS:'1'};
  const rows=[normalize({...raw,EDOCVE:'2',EDONOM:'BAJA CALIFORNIA'},2009),normalize(raw,2009),normalize({...raw,SEXO:'1'},2009)];
  const sample=selectSample(rows);
  assert.deepEqual(sample,selectSample([...rows].reverse()));
  assert.equal(rows[0].entidad_clave,'02');
  assert.equal(sample[0].LN,10); assert.equal(sample[0].entidad_clave,'01');
});
