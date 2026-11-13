const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./framework-fixture.cjs');
let project,file,original;
before(async()=>{project=await fixture();file=path.join(project.root,'GameplayCameraSystem/Adaptation/ActorPerformance.lua');original=await fs.readFile(file,'utf8');});
test('performance choices come from the workspace mapping and refresh with source changes',async()=>{
 const before=await project.snapshot();assert.equal(before.effectCatalog.performanceTypes.length,11);assert.equal(before.effectCatalog.performanceTypeIssue,'');assert.ok(before.effectCatalog.performanceTypes.includes('PERFORMANCE_NPC'));assert.ok(before.effectCatalog.objects.length>0);
 try{
  const changed=original.replace('local PerformanceTypes = {','local PerformanceTypes = {\n [42]="PERFORMANCE_EDITOR_TEST",');await fs.writeFile(file,changed);
  const after=await project.snapshot();assert.notEqual(before.snapshotRevision,after.snapshotRevision);assert.ok(after.effectCatalog.performanceTypes.includes('PERFORMANCE_EDITOR_TEST'));assert.equal(after.effectCatalog.performanceTypes.at(-1),'PERFORMANCE_EDITOR_TEST');assert.deepEqual(after.issues,[]);
 }finally{await fs.writeFile(file,original);}
});
test('mapping reader ignores comments and example strings and de-duplicates actual names',async()=>{
 try{
  const prefix='-- local PerformanceTypes = {[7]="PERFORMANCE_FAKE"}\nlocal example = [=[local PerformanceTypes = { [8]="PERFORMANCE_EXAMPLE" }]=]\n';
  const changed=prefix+original.replace('local PerformanceTypes = {','local PerformanceTypes = {\n --[[ extra closing braces } } and text ]]\n [42]="PERFORMANCE_NPC",');await fs.writeFile(file,changed);
  const catalog=(await project.snapshot()).effectCatalog;assert.equal(catalog.performanceTypeIssue,'');assert.equal(catalog.performanceTypes.length,11);assert.ok(!catalog.performanceTypes.includes('PERFORMANCE_FAKE'));assert.ok(!catalog.performanceTypes.includes('PERFORMANCE_EXAMPLE'));
 }finally{await fs.writeFile(file,original);}
});
test('unavailable mapping has a separate readable issue and preserves other catalogs',async()=>{
 try{
  await fs.writeFile(file,'return {}');const snapshot=await project.snapshot();assert.deepEqual(snapshot.effectCatalog.performanceTypes,[]);assert.match(snapshot.effectCatalog.performanceTypeIssue,/未找到/);assert.ok(snapshot.effectCatalog.objects.length>0);assert.equal(snapshot.effectCatalog.channels.length,15);assert.deepEqual(snapshot.issues,[]);
 }finally{await fs.writeFile(file,original);}
 assert.equal((await project.snapshot()).effectCatalog.performanceTypes.length,11);
});
test('dropdown choices preserve existing custom names and never change the stored identifier',async()=>{
 const {performanceBaseOptions}=await import('../src/performanceBases.mjs');
 const options=performanceBaseOptions(['PERFORMANCE_PLAYER','PERFORMANCE_NPC'],[{type:'Value',data:{PerformanceType:{BaseName:'PERFORMANCE_CUSTOM'}}}],'PERFORMANCE_OLD');
 assert.deepEqual(options,[{value:'PERFORMANCE_PLAYER',registered:true},{value:'PERFORMANCE_NPC',registered:true},{value:'PERFORMANCE_CUSTOM',registered:false},{value:'PERFORMANCE_OLD',registered:false}]);
});
