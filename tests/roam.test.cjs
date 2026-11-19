const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {fixture,readReference}=require('./framework-fixture.cjs'),{encode}=require('../electron/project.cjs');
let project;
const base='Assets/GameplayCameraSystem/CameraAssets/RoamCamera/Sequence/';
before(async()=>{project=await fixture();});
test('Roam exposes its own pipeline and shares thirteen state channels with Actor spaces',async()=>{
 const {pipelineProblems}=await import('../src/pipelineModel.mjs'),{channelsFor}=await import('../src/rangeChannels.mjs'),{valueReferences}=await import('../src/valueChannels.mjs'),{rigChoicesBySpace}=await import('../src/pipelineViewModel.mjs');
 const snapshot=await project.snapshot(),pipeline=snapshot.assets.find(a=>a.path===base+'PipelineAssets/Sequence_Default.pipeline'),target=snapshot.assets.find(a=>a.path===base+'ValueAssets/Enter/Sequence_10001.transitionValue');
 assert.deepEqual(pipelineProblems(pipeline.data),[]);assert.equal(channelsFor(target.data.Channels).length,13);assert.ok(channelsFor(target.data.Channels).some(([name])=>name==='AnchorLocOffset'));assert.ok(channelsFor(target.data.Channels).some(([name])=>name==='Distance'));assert.ok(!channelsFor(target.data.Channels).some(([name])=>name==='LocationX'));assert.deepEqual(valueReferences('Scalar',true,snapshot.effectCatalog.references),valueReferences('Scalar',false,snapshot.effectCatalog.references));assert.ok(valueReferences('Vector',true,snapshot.effectCatalog.references).includes('World'));assert.ok(valueReferences('Vector',true,snapshot.effectCatalog.references).includes('TransitionStart'));assert.ok(valueReferences('Vector',true,snapshot.effectCatalog.references).includes('CurrentViewpoint|socket_chest|Socket'));assert.ok(valueReferences('Scalar',true,snapshot.effectCatalog.references).includes('IdleDefault'));assert.ok(rigChoicesBySpace(snapshot.assets).some(g=>g.space==='Roam'));
 const doc=await project.read(target.path),saved=await project.save({...doc,text:encode({...target.data,Duration:1.2})});assert.equal(JSON.parse(saved.text).SequenceId,10001);await project.save({...saved,text:doc.text});
});
test('Sequence targets reject duplicate IDs, defaults and Actor performance metadata',async()=>{
 const input=await project.read(base+'InputAssets/Sequence_Enter.transitionInput'),value=JSON.parse(input.text),first=await readReference(project,value.ValueAssets[0]),second=await readReference(project,value.ValueAssets[1]),data=JSON.parse(second.text);
 for(const candidate of [{...data,SequenceId:JSON.parse(first.text).SequenceId},{...data,SequenceId:0},{...data,PerformanceType:{BaseName:'PERFORMANCE_PLAYER'}}])await assert.rejects(()=>project.save({...second,text:encode(candidate)}));
 await assert.rejects(()=>project.save({...input,text:encode({...value,DefaultValueAsset:value.ValueAssets[0]})}));assert.equal((await project.read(input.path)).text,input.text);assert.equal((await project.read(second.path)).text,second.text);
});
test('Actor inputs accept Enter Change Exit and reject legacy mount fields',async()=>{
 const doc=await project.read('Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/Dash.rig'),data=JSON.parse(doc.text);assert.deepEqual(Object.keys(data.Processors.Input),['Assets','Enter','Change','Exit','Blend']);
 const bad=structuredClone(data);bad.Processors.Input.Focus=bad.Processors.Input.Enter;delete bad.Processors.Input.Enter;await assert.rejects(()=>project.save({...doc,text:encode(bad)}),/Focus/);
 const duplicate=structuredClone(data);duplicate.Processors.Input.Change=duplicate.Processors.Input.Enter;await assert.rejects(()=>project.save({...doc,text:encode(duplicate)}),/Dash_Change/);
});
test('socket reference and rotation policy round trip; scalar socket references are rejected',async()=>{
 const file='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/ValueAssets/Focus/Character/Dash_Player.transitionValue',doc=await project.read(file),data=JSON.parse(doc.text),{changeReference,valueReferences}=await import('../src/valueChannels.mjs');
 assert.ok(valueReferences('Angle',false,(await project.snapshot()).effectCatalog.references).includes('CurrentViewpoint|socket_chest|Socket'));
 data.Channels.RotationYaw=changeReference(data.Channels.RotationYaw,'CurrentViewpoint|socket_chest|Socket');
 const saved=await project.save({...doc,text:encode(data)});assert.equal(JSON.parse(saved.text).Channels.RotationYaw.Reference,'CurrentViewpoint|socket_chest|Socket');
 const world=changeReference(data.Channels.RotationYaw,'World');assert.equal(Object.hasOwn(world,'bUseSocketRotation'),false);
 const bad=structuredClone(data);bad.Channels.FOV.Reference='CurrentViewpoint|socket_chest';bad.Channels.FOV.bUseSocketRotation=true;await assert.rejects(()=>project.save({...saved,text:encode(bad)}));await project.save({...saved,text:doc.text});
});
