const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./framework-fixture.cjs'),{encode,cleanRelative,references}=require('../electron/project.cjs');
const {assetKey}=require('../electron/asset-protocol.cjs');let project;
before(async()=>{project=await fixture();});
const mutate=async request=>project.mutate({...request,snapshotRevision:(await project.snapshot()).snapshotRevision});
test('current workspace opens from Lua or CameraFramework and validates every asset with real Lua',async()=>{
 const s=await project.snapshot();assert.ok(s.assets.length>=240);assert.ok(!s.assets.some(a=>a.type.startsWith('SwitchViewpoint')));assert.deepEqual(s.issues,[]);assert.equal(s.effectCatalog.channels.length,15);
 const result=await project.validate();assert.equal(result.checked,s.assets.length);assert.deepEqual(result.issues,[]);
 assert.equal((await require('../electron/project.cjs').Project.open(project.workspaceRoot,project.storage,project.runtime)).root,project.root);
});
test('path traversal and reserved or foreign asset directories are rejected',async()=>{
 for(const p of ['../outside','Assets/../x','C:/x','Assets//x','Assets/NUL.rig','Assets/x.','Assets/a\\b'])assert.throws(()=>cleanRelative(p));
 await assert.rejects(()=>project.read('../outside'));
 const a=(await project.snapshot()).assets.find(a=>a.type==='Smooth');await assert.rejects(()=>mutate({kind:'copy',sourcePath:a.path,path:'Assets/Foreign/x.smooth'}),/所有权/);
});
test('unsaved invalid ranges and duplicate JSON fields fail without changing disk',async()=>{
 const snap=await project.snapshot(),a=snap.assets.find(a=>a.type==='Range'),doc=await project.read(a.path),bad=JSON.parse(doc.text);bad.Channels.Distance.Min=99999;bad.Channels.Distance.Max=-1;
 assert.ok((await project.validate({[a.path]:encode(bad)})).issues.length);assert.equal((await project.read(a.path)).text,doc.text);
 const duplicate=doc.text.replace(/"SchemaVersion"\s*:\s*\d+/,match=>match+', '+match);assert.ok((await project.validate({[a.path]:duplicate})).issues.length);
});
test('version one and every explicit scalar channel are required even when disabled',async()=>{
 const a=(await project.snapshot()).assets.find(a=>a.type==='Input'),doc=await project.read(a.path);
 for(const change of [d=>d.SchemaVersion=5,d=>delete d.Channels.OffCenterOffsetX,d=>d.Channels.RotationYaw.Type='Scalar']){const d=JSON.parse(doc.text);change(d);await assert.rejects(()=>project.save({...doc,text:encode(d)}));}
 assert.equal((await project.read(a.path)).text,doc.text);
});
test('valid save creates a recovery copy and rejects stale revisions without generating plans',async()=>{
 const a=(await project.snapshot()).assets.find(a=>a.type==='Effect'),doc=await project.read(a.path),data=JSON.parse(doc.text);data.Description+=' editor test';
 const saved=await project.save({...doc,text:encode(data)});assert.ok(await fs.stat(saved.backup));await assert.rejects(()=>project.save({...doc,text:doc.text}),/外部修改/);
 await project.save({...saved,text:doc.text});assert.equal((await project.snapshot()).files.some(f=>f.path.endsWith('.postProcessingPlan')),false);
});
test('save-all validates the combined drafts and rolls back a failed write',async()=>{
 const assets=(await project.snapshot()).assets.filter(a=>a.type==='Effect').slice(0,2),docs=await Promise.all(assets.map(a=>project.read(a.path)));
 const requests=docs.map(d=>({...d,text:encode({...JSON.parse(d.text),Description:'batch'})}));
 const atomic=project.atomic.bind(project);let writes=0;project.atomic=async(...args)=>{if(++writes===2)throw Error('injected write');return atomic(...args);};
 try{await assert.rejects(()=>project.saveMany(requests),/injected write/);}finally{project.atomic=atomic;}
 for(const d of docs)assert.equal((await project.read(d.path)).text,d.text);
 const saved=await project.saveMany(requests);assert.equal(saved[0].backup,saved[1].backup);await project.saveMany(saved.map((d,i)=>({...d,text:docs[i].text})));
});
test('copy and delete register auxiliary assets transactionally in their owner manifest',async()=>{
 const a=(await project.snapshot()).assets.find(a=>a.type==='Smooth'),destination='Assets/GameplayCameraSystem/EditorTests/Extra.smooth';
 const before=await project.read('Assets/GameplayCameraSystem/Framework.camera');
 await mutate({kind:'copy',sourcePath:a.path,path:destination});assert.deepEqual((await project.validate()).issues,[]);
 assert.ok(JSON.parse((await project.read(before.path)).text).Assets.includes(assetKey(destination)));
 await mutate({kind:'delete',sourcePath:destination,sourceRevision:(await project.read(destination)).revision});assert.deepEqual(JSON.parse((await project.read(before.path)).text),JSON.parse(before.text));
});
test('shared curve moves update manifests and every raw Assets-relative reference',async()=>{
 const source='Assets/Shared/CurveAssets/Bezier/Linear.curve',destination='Assets/Shared/CurveAssets/Bezier/LinearRenamed.curve',before=await project.read(source);
 await mutate({kind:'move',sourcePath:source,path:destination,sourceRevision:before.revision});const s=await project.snapshot();assert.ok(s.assets.some(a=>a.refs.some(ref=>ref.path===destination)));assert.deepEqual((await project.validate()).issues,[]);
 await mutate({kind:'move',sourcePath:destination,path:source,sourceRevision:(await project.read(destination)).revision});assert.deepEqual(JSON.parse((await project.read(source)).text),JSON.parse(before.text));
});
test('moving a Focus input updates the Focus mount and preserves the user input list',async()=>{
 const source='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/InputAssets/Dash_Focus.transitionInput',destination='Assets/GameplayCameraSystem/EditorTests/Focus.transitionInput',rig='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/Dash.rig',before=await project.read(rig);
 await mutate({kind:'move',sourcePath:source,path:destination,sourceRevision:(await project.read(source)).revision});const data=JSON.parse((await project.read(rig)).text);assert.equal(data.Processors.Input.Focus,assetKey(destination));assert.deepEqual(data.Processors.Input.Assets,JSON.parse(before.text).Processors.Input.Assets);
 await mutate({kind:'move',sourcePath:destination,path:source,sourceRevision:(await project.read(destination)).revision});assert.deepEqual(JSON.parse((await project.read(rig)).text),JSON.parse(before.text));
});
test('referenced definitions cannot be deleted and stale mutations do not write',async()=>{
 const s=await project.snapshot(),a=s.assets.find(a=>a.type==='TransitionInput');await assert.rejects(()=>mutate({kind:'delete',sourcePath:a.path,sourceRevision:a.revision}),/引用/);
 await assert.rejects(()=>project.mutate({kind:'copy',sourcePath:a.path,path:'Assets/GameplayCameraSystem/Stale.transitionInput',snapshotRevision:'old'}),/变化/);
});
test('failed multi-file move restores source and all dependents',async()=>{
 const s=await project.snapshot(),a=s.assets.find(a=>a.type==='TransitionInput'),docs=await Promise.all([a,...s.assets.filter(d=>d.refs.some(r=>r.path===a.path))].map(d=>project.read(d.path)));
 const atomic=project.atomic.bind(project);let writes=0;project.atomic=async(...args)=>{if(++writes===2)throw Error('injected move');return atomic(...args);};
 try{await assert.rejects(()=>mutate({kind:'move',sourcePath:a.path,path:'Assets/GameplayCameraSystem/EditorTests/Failure.transitionInput',sourceRevision:a.revision}),/injected move/);}finally{project.atomic=atomic;}
 for(const d of docs)assert.equal((await project.read(d.path)).text,d.text);
});
test('folder moves rewrite shared references and preserve ordinary files',async()=>{
 const source='Assets/GameplayCameraSystem/EditorFolder',destination='Assets/GameplayCameraSystem/EditorMoved',a=(await project.snapshot()).assets.find(a=>a.type==='Smooth');
 await mutate({kind:'create-directory',path:source});await mutate({kind:'copy',sourcePath:a.path,path:source+'/Copied.smooth'});await fs.writeFile(path.join(project.root,source,'notes.md'),'notes');
 await mutate({kind:'move',sourcePath:source,path:destination});assert.equal((await project.read(destination+'/notes.md')).text,'notes');assert.deepEqual((await project.validate()).issues,[]);
 await mutate({kind:'move',sourcePath:destination,path:source});await mutate({kind:'delete',sourcePath:source+'/Copied.smooth',sourceRevision:(await project.read(source+'/Copied.smooth')).revision});
});
test('reference discovery distinguishes raw keys from file paths and ignores Params and prose',()=>{
 const refs=references({Description:'Shared/fake.curve',Source:{Params:['Shared/fake.curve']},Ranges:['GameplayCameraSystem/a.range'],Focus:'GameplayCameraSystem/a.transitionInput',ValueAssets:['GameplayCameraSystem/a.transitionValue'],PerformanceType:{BaseName:'PERFORMANCE_NPC',CodeName:'Shared/fake.curve'},CurrentAssetKey:'PostProcessingSystem/Filter/A.filter'});
 assert.deepEqual(refs.map(r=>r.type),['Range','TransitionInput','Value','Filter']);assert.ok(refs.every(r=>r.path.startsWith('Assets/')));
});
test('new rig copies are registered for execution and can be removed when unused',async()=>{
 const a=(await project.snapshot()).assets.find(a=>a.path.endsWith('/Dash/Dash.rig')),destination='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/NewScene/NewScene.rig';
 await mutate({kind:'copy',sourcePath:a.path,path:destination});assert.ok(JSON.parse((await project.read('Assets/GameplayCameraSystem/Framework.camera')).text).Rigs.some(r=>r.Name==='NewScene'));
 await mutate({kind:'delete',sourcePath:destination,sourceRevision:(await project.read(destination)).revision});
});
