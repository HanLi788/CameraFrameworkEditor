const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./framework-fixture.cjs'),{encode}=require('../electron/project.cjs');
let project,labels;
before(async()=>{project=await fixture();labels=await import('../src/postProcessingLabels.mjs');});
const post='Assets/PostProcessingSystem/Add/Actor/Characters/LuaPlayer/Movement/ViewpointVelocity/MovementSpeed.numEffect';
test('three framework manifests and all independent post asset types are recognized',async()=>{
 const s=await project.snapshot();for(const kind of ['Share','Camera','PostProcessing','VirtualInput','Filter','NumEffect'])assert.ok(s.assets.some(a=>a.type===kind),kind);assert.deepEqual((await project.validate()).issues,[]);assert.ok(s.effectCatalog.postObjects.some(o=>o.name==='Actor'));
});
test('numeric effects save current source/domain/smoothing and reject obsolete event fields',async()=>{
 const doc=await project.read(post),data=JSON.parse(doc.text);data.Domain='[0,1000]';data.Outputs={ExposureCompensation:{Range:'{2}'}};data.SmoothTime=.2;
 const saved=await project.save({...doc,text:encode(data)});assert.deepEqual(JSON.parse(saved.text),data);for(const field of ['Events','Mode','Priority']){await assert.rejects(()=>project.save({...saved,text:encode({...data,[field]:field==='Events'?[]:1})}));}await project.save({...saved,text:doc.text});
});
test('filter rename rewrites root mounts and selected key in one transaction',async()=>{
 const source='Assets/PostProcessingSystem/Filter/Natural.filter',destination='Assets/PostProcessingSystem/Filter/NaturalRenamed.filter',s=await project.snapshot();
 await project.mutate({kind:'move',sourcePath:source,path:destination,sourceRevision:(await project.read(source)).revision,snapshotRevision:s.snapshotRevision});
 const root=JSON.parse((await project.read('Assets/PostProcessingSystem/Framework.postProcessing')).text);assert.equal(root.Processors.Filter.CurrentAssetKey,destination.slice(7));assert.ok(root.Processors.Filter.Assets.some(m=>m.Asset===destination.slice(7)));assert.deepEqual((await project.validate()).issues,[]);
 await project.mutate({kind:'move',sourcePath:destination,path:source,sourceRevision:(await project.read(destination)).revision,snapshotRevision:(await project.snapshot()).snapshotRevision});
});
test('filter creation and deletion update the root mount without generated plans',async()=>{
 const destination='Assets/PostProcessingSystem/Filter/Copied.filter';await project.mutate({kind:'copy',sourcePath:'Assets/PostProcessingSystem/Filter/Warm.filter',path:destination,snapshotRevision:(await project.snapshot()).snapshotRevision});assert.deepEqual((await project.validate()).issues,[]);
 await project.mutate({kind:'delete',sourcePath:destination,sourceRevision:(await project.read(destination)).revision,snapshotRevision:(await project.snapshot()).snapshotRevision});assert.equal((await project.snapshot()).files.some(f=>f.path.endsWith('.postProcessingPlan')),false);
});
test('all Lua postprocessing channels have bilingual labels and dedicated group icons; search accepts either language and native names',async()=>{
 const channels=(await project.snapshot()).effectCatalog.postProcessing;
 for(const c of channels){
  const base=c.component?c.name.slice(0,-c.component.length):c.name;
  assert.ok(labels.postFields[base],base);assert.ok(labels.postGroups[c.group],c.group);
  assert.match(labels.postChannelLabel(c,'zh'),/[\u3400-\u9fff]/,c.name);
  assert.doesNotMatch(labels.postChannelLabel(c,'en'),/[\u3400-\u9fff]/,c.name);
  assert.equal(labels.matchesPostChannel(c,c.native),true);
 }
 const groups=[...new Set(channels.map(c=>c.group))],icons=groups.map(labels.postGroupIcon);
 assert.equal(new Set(icons).size,groups.length);assert.ok(!icons.includes('folder'));
 const exposure=channels.find(c=>c.name==='ExposureCompensation');
 assert.equal(labels.postChannelLabel(exposure,'zh'),'曝光补偿');assert.equal(labels.postChannelLabel(exposure,'en'),'Exposure Compensation');
 assert.equal(labels.matchesPostChannel(exposure,'曝光补偿'),true);assert.equal(labels.matchesPostChannel(exposure,'exposure compensation'),true);
 const red=channels.find(c=>c.name==='SceneColorTintR');assert.equal(labels.postChannelLabel(red,'zh'),'场景颜色色调 · R');
 assert.equal(labels.postChannelLabel({name:'CustomField'},'en'),'Custom Field');
});

test('first boolean effect can be created without a pre-existing template and is registered',async()=>{
 const destination='Assets/PostProcessingSystem/Add/Editor/First.boolEffect';
 await project.mutate({kind:'create-asset',type:'BoolEffect',path:destination,snapshotRevision:(await project.snapshot()).snapshotRevision});
 const data=JSON.parse((await project.read(destination)).text);assert.equal(data.SchemaVersion,1);assert.equal(data.Events,undefined);assert.deepEqual((await project.validate()).issues,[]);
 await project.mutate({kind:'delete',sourcePath:destination,sourceRevision:(await project.read(destination)).revision,snapshotRevision:(await project.snapshot()).snapshotRevision});
});
