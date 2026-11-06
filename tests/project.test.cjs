const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {Project,encode,references,cleanRelative}=require('../electron/project.cjs');
let temp,project;
const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/MyWorks/Lua/CameraFramework';
before(async()=>{temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-editor-test-'));const base=path.join(temp,'中文工作区');await fs.mkdir(base);await fs.cp(source,path.join(base,'CameraFramework'),{recursive:true});await fs.cp(path.join(path.dirname(source),'Foundation'),path.join(base,'Foundation'),{recursive:true});project=await Project.open(path.join(base,'CameraFramework'),path.join(temp,'data'),path.resolve('runtime/lua54.exe'));});
after(()=>console.log('Test fixture retained for inspection:',temp));
test('loads the current path assets and validates all assets through real Lua, with Unicode project paths',async()=>{const s=await project.snapshot();assert.equal(s.assets.length,207);assert.equal(s.issues.length,0);const r=await project.validate();assert.equal(r.runtime,true);assert.equal(r.checked,207);assert.deepEqual(r.issues,[]);});
test('rejects traversal, reserved paths and invalid segments',async()=>{for(const p of ['../outside','Assets/../x','C:/x','Assets//x','Assets/NUL.rig','Assets/x.','Assets/a\\b'])assert.throws(()=>cleanRelative(p));await assert.rejects(()=>project.read('../outside'));});
test('validates unsaved drafts without writing and rejects invalid range values',async()=>{const s=await project.snapshot();const a=s.assets.find(a=>a.type==='Range');const before=await project.read(a.path);const data=JSON.parse(before.text);data.Channels.Dist.Min=99999;data.Channels.Dist.Max=-1;const result=await project.validate({[a.path]:encode(data)});assert.ok(result.issues.some(i=>i.severity==='error'));assert.equal((await project.read(a.path)).text,before.text);});
test('detects duplicate JSON fields using the runtime decoder',async()=>{const a=(await project.snapshot()).assets.find(a=>a.type==='Occlusion');const before=await project.read(a.path);const text=before.text.replace('"SchemaVersion": 4','"SchemaVersion": 4, "SchemaVersion": 4');const result=await project.validate({[a.path]:text});assert.ok(result.issues.length>0);});
test('saves a valid edit with recovery copy, rejects stale writes, then restores',async()=>{const a=(await project.snapshot()).assets.find(a=>a.type==='Effect');const before=await project.read(a.path);const data=JSON.parse(before.text);data.Description+=' editor test';const saved=await project.save({path:a.path,text:encode(data),revision:before.revision});assert.equal(saved.text,encode(data));assert.ok(await fs.stat(saved.backup));await assert.rejects(()=>project.save({path:a.path,text:before.text,revision:before.revision}),/外部修改/);await project.save({path:a.path,text:before.text,revision:saved.revision});});
test('prevents saving incompatible curves referenced by transition assets',async()=>{const a=(await project.snapshot()).assets.find(a=>a.path==='Assets/CurveAssets/Bezier/Linear.curve');const before=await project.read(a.path);const data=JSON.parse(before.text);data.P4.Y=0;await assert.rejects(()=>project.save({path:a.path,text:encode(data),revision:before.revision}));assert.equal((await project.read(a.path)).text,before.text);});
test('copy, move and delete use paths anywhere inside the framework without an index',async()=>{
  let snap=await project.snapshot();const original=snap.assets.find(a=>a.type==='Smooth');
  const first='Custom/任意目录/Example.smooth',second='Assets/AnotherFolder/Renamed.smooth';
  await project.mutate({kind:'copy',sourcePath:original.path,path:first,snapshotRevision:snap.snapshotRevision});
  snap=await project.snapshot();assert.ok(snap.assets.some(a=>a.path===first));
  await project.mutate({kind:'move',sourcePath:first,path:second,snapshotRevision:snap.snapshotRevision,sourceRevision:(await project.read(first)).revision});
  snap=await project.snapshot();assert.ok(snap.assets.some(a=>a.path===second));assert.equal(JSON.parse((await project.read(second)).text).Id,undefined);
  assert.equal(await fs.stat(path.join(project.root,first)).catch(()=>null),null);
  await project.mutate({kind:'delete',sourcePath:second,snapshotRevision:snap.snapshotRevision,sourceRevision:(await project.read(second)).revision});
  assert.equal((await project.snapshot()).assets.length,207);
  assert.equal(await fs.stat(path.join(project.root,'Assets/Index.json')).catch(()=>null),null);
});
test('rejects deletion of referenced assets and stale asset mutations',async()=>{
  const snap=await project.snapshot(),a=snap.assets.find(a=>a.path==='Assets/CurveAssets/Bezier/Linear.curve');
  await assert.rejects(()=>project.mutate({kind:'delete',sourcePath:a.path,snapshotRevision:snap.snapshotRevision,sourceRevision:a.revision}),/引用/);
  await assert.rejects(()=>project.mutate({kind:'copy',sourcePath:a.path,path:'Assets/New.curve',snapshotRevision:'outdated'}),/资产文件已变化/);
});
test('external text changes cannot be overwritten silently',async()=>{const doc=await project.read('README.md');await fs.writeFile(path.join(project.root,'README.md'),doc.text+'\nExternal change\n');await assert.rejects(()=>project.save({path:doc.path,revision:doc.revision,text:'Replacement'}),/外部修改/);assert.match((await project.read(doc.path)).text,/External change/);});
test('rejects root Id and legacy mount structures without writing',async()=>{
  const a=(await project.snapshot()).assets.find(a=>a.type==='Rig'),doc=await project.read(a.path),data=JSON.parse(doc.text);
  data.Id='Changed';await assert.rejects(()=>project.save({...doc,text:encode(data)}),/根 Id/);delete data.Id;
  data.Processors.Effects={bEnabled:true,Assets:[]};await assert.rejects(()=>project.save({...doc,text:encode(data)}));
  assert.equal((await project.read(a.path)).text,doc.text);
});
test('save-all validates the combined draft and rejects the entire batch on conflict',async()=>{
  const assets=(await project.snapshot()).assets.filter(a=>a.type==='Effect').slice(0,2);const docs=await Promise.all(assets.map(a=>project.read(a.path)));
  const requests=docs.map(d=>{const data=JSON.parse(d.text);data.Description+=' Batch';return {...d,text:encode(data)};});
  await assert.rejects(()=>project.saveMany([{...requests[0]}, {...requests[1],revision:'stale'}]),/外部修改/);
  assert.equal((await project.read(docs[0].path)).text,docs[0].text);
  const saved=await project.saveMany(requests);assert.equal(saved.length,2);assert.equal(saved[0].backup,saved[1].backup);
  await project.saveMany(saved.map((d,i)=>({...d,text:docs[i].text})));
});

test('moving referenced input rewrites dotted channel arrays and lifecycle references atomically',async()=>{
  let snap=await project.snapshot();const source=snap.assets.find(a=>a.path.endsWith('/Dash/InputAssets/Enter.input'));
  const rig=snap.assets.find(a=>a.path.endsWith('/Dash/Dash.rig')),before=await project.read(rig.path),dest='Custom/MoveEnter.input';
  const result=await project.mutate({kind:'move',sourcePath:source.path,path:dest,snapshotRevision:snap.snapshotRevision,sourceRevision:source.revision});
  const data=JSON.parse((await project.read(rig.path)).text);
  assert.ok(data.Processors.Input.Transitions.includes(dest));assert.ok(data.Processors.Input.Channels['AnchorLocOffset.X'].includes(dest));
  assert.ok(result.updated.includes(rig.path));assert.equal((await project.validate()).issues.length,0);
  snap=await project.snapshot();await project.mutate({kind:'move',sourcePath:dest,path:source.path,snapshotRevision:snap.snapshotRevision,sourceRevision:(await project.read(dest)).revision});
  assert.deepEqual(JSON.parse((await project.read(rig.path)).text),JSON.parse(before.text));
});
test('reference discovery ignores ordinary strings and keeps scalar dependency types',()=>{
  const refs=references({Source:{Object:'Owner',Interface:'Query',Params:['Assets/fake.curve']},Description:'Assets/fake.curve',RangeAsset:'Assets/a.range',Channels:{Dist:{Curve:'Assets/b.curve'}},ValueAssets:[{Id:10001,Path:'Assets/c.value'}]});
  assert.deepEqual(refs.map(r=>r.type),['Range','Curve','Value']);
});
test('new rig keeps its filename at scene level and reserves effect/pipeline folders',async()=>{
  let snap=await project.snapshot();const rig=snap.assets.find(a=>a.path.endsWith('/Dash/Dash.rig')),dest='Custom/NewScene/NewScene.rig';
  await project.mutate({kind:'copy',sourcePath:rig.path,path:dest,snapshotRevision:snap.snapshotRevision});
  for(const folder of ['EffectAssets','PipelineAssets'])assert.ok(await fs.stat(path.join(project.root,'Custom/NewScene',folder,'.gitkeep')));
  snap=await project.snapshot();await project.mutate({kind:'delete',sourcePath:dest,snapshotRevision:snap.snapshotRevision,sourceRevision:(await project.read(dest)).revision});
});
test('invalid dynamic source descriptions and non-scalar arguments fail save validation',async()=>{
  const a=(await project.snapshot()).assets.find(a=>a.type==='Effect'),doc=await project.read(a.path),original=JSON.parse(doc.text);
  for(const change of [d=>d.Source.Object='Owner:GetSomething()',d=>d.Source.Interface='Get.Value',d=>d.Source.Params=[null],d=>d.Source.Params={Axis:'X'},d=>d.Source.Params=[{}],d=>delete d.Source.bMemberFunction]) {
    const data=structuredClone(original);change(data);await assert.rejects(()=>project.save({...doc,text:encode(data)}));
  }
  assert.equal((await project.read(doc.path)).text,doc.text);
});

test('failed multi-file move restores referencing documents and source',async()=>{
  const snap=await project.snapshot(),source=snap.assets.find(a=>a.path.endsWith('/Dash/InputAssets/Enter.input'));
  const users=snap.assets.filter(a=>a.refs.some(r=>r.path===source.path));const before=await Promise.all([source,...users].map(a=>project.read(a.path)));
  const destination='Custom/Failure.input',atomic=project.atomic.bind(project);let count=0;
  project.atomic=async(...args)=>{if(++count===2)throw Error('injected write failure');return atomic(...args);};
  try{await assert.rejects(()=>project.mutate({kind:'move',sourcePath:source.path,path:destination,snapshotRevision:snap.snapshotRevision,sourceRevision:source.revision}),/injected write failure/);}
  finally{project.atomic=atomic;}
  for(const doc of before)assert.equal((await project.read(doc.path)).text,doc.text);
  assert.equal(await fs.stat(path.join(project.root,destination)).catch(()=>null),null);
});
test('external dependency changes during validation cancel a mutation before writes',async()=>{
  const snap=await project.snapshot(),source=snap.assets.find(a=>a.type==='Smooth'),dependency=snap.assets.find(a=>a.type==='Effect');
  const doc=await project.read(dependency.path),validate=project.validate.bind(project),dest='Custom/Stale.smooth';
  project.validate=async(...args)=>{const result=await validate(...args);await fs.writeFile(path.join(project.root,doc.path),doc.text+'\n');return result;};
  try{await assert.rejects(()=>project.mutate({kind:'copy',sourcePath:source.path,path:dest,snapshotRevision:snap.snapshotRevision}),/校验期间资产文件发生变化/);}
  finally{project.validate=validate;await fs.writeFile(path.join(project.root,doc.path),doc.text);}
  assert.equal(await fs.stat(path.join(project.root,dest)).catch(()=>null),null);
});
