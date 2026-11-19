const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./framework-fixture.cjs');
const {encode}=require('../electron/project.cjs'),{Documents}=require('../electron/documents.cjs');
const base='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/';
const blend=base+'InputBlendAssets/Dash_Default.inputBlend',rig=base+'Dash.rig';
let project;
before(async()=>{project=await fixture();assert.deepEqual((await project.warmup()).issues,[]);});
after(()=>project?.close());
async function weight(value){const doc=await project.read(blend),data=JSON.parse(doc.text);data.Rows[0].Weights.FOV=value;return {...doc,text:encode(data)};}

test('background proof saves one dirty asset without rescanning or rerunning Lua',async()=>{
 const store=new Documents(project),doc=await store.ensure(blend),write=await weight(2),snapshot=project.snapshot;
 let scans=0;project.snapshot=function(...args){scans++;return snapshot.apply(this,args);};
 try{
  store.editText({path:blend,baseText:doc.text,text:write.text});await store.validateDrafts();
  assert.equal(doc.validation.status,'valid');const requests=project.validator.stats.validationRequests;
  const check=await project.checkCandidate({[blend]:write.text});assert.ok(check.checked>0&&check.checked<10);
  await store.save({paths:[blend],versions:{[blend]:doc.version}});
  assert.equal(scans,0);assert.equal(project.validator.stats.validationRequests,requests);assert.equal(project.validator.stats.starts,1);
  assert.equal((await project.read(blend)).text,write.text);
 }finally{store.close();project.snapshot=snapshot;}
});

test('a valid combined draft cannot authorize saving only one incompatible document',async()=>{
 const a=await project.read(rig),b=await project.read(blend),rigData=JSON.parse(a.text),blendData=JSON.parse(b.text);
 rigData.Processors.Input.Assets=[];
 blendData.Rows=blendData.Rows.filter(row=>row.InputAsset.$ref.DocumentId!==JSON.parse(a.text).Processors.Input.Assets[0].$ref.DocumentId);
 const check=await project.checkCandidate({[rig]:encode(rigData),[blend]:encode(blendData)});assert.deepEqual(check.issues,[]);
 await assert.rejects(()=>project.save({...a,text:encode(rigData)}));assert.equal((await project.read(rig)).text,a.text);
});

test('incremental validation rejects duplicate JSON fields and invalid shared dependencies',async()=>{
 const doc=await project.read(blend);
 await assert.rejects(()=>project.save({...doc,text:doc.text.replace('"SchemaVersion": 1','"SchemaVersion": 1, "SchemaVersion": 1')}));
 const curve='Assets/Shared/CurveAssets/CubicHermiteSpline/RangeUnit.curve',source=await project.read(curve),data=JSON.parse(source.text);
 for(const point of data.Points)point.Y=0;
 const result=await project.checkCandidate({[curve]:encode(data)});assert.ok(result.issues.length>0);
 await assert.rejects(()=>project.save({...source,text:encode(data)}));assert.equal((await project.read(curve)).text,source.text);
});

test('external target and transitive dependency changes block cached and in-flight proofs',async()=>{
 const write=await weight(3),original=await project.read(blend);
 await project.checkCandidate({[blend]:write.text});await fs.writeFile(path.join(project.root,blend),original.text+'\n');
 await assert.rejects(()=>project.save(write),/外部修改/);await fs.writeFile(path.join(project.root,blend),original.text);
 const curve='Assets/Shared/CurveAssets/CubicHermiteSpline/RangeUnit.curve',source=await project.read(curve),check=project.validator.check;
 project.proofs.clear();project.validator.check=async function(...args){const result=await check.apply(this,args);await fs.writeFile(path.join(project.root,curve),source.text+'\n');return result;};
 try{await assert.rejects(()=>project.save(write),/外部修改/);assert.equal((await project.read(blend)).text,original.text);}
 finally{project.validator.check=check;await fs.writeFile(path.join(project.root,curve),source.text);project.noteChange(curve);await project.synchronize();}
});
test('a receipt read of an externally changed dependency cannot refresh a stale proof stamp',async()=>{
 const curve='Assets/Shared/CurveAssets/CubicHermiteSpline/RangeUnit.curve',source=await project.read(curve),write=await weight(3);
 try{await fs.writeFile(path.join(project.root,curve),source.text+'\n');await project.read(curve);project.proofs.clear();await assert.rejects(()=>project.save(write),/外部修改/);}
 finally{await fs.writeFile(path.join(project.root,curve),source.text);project.noteChange(curve);await project.synchronize();}
});

test('index and validator module changes invalidate a previously cached candidate',async()=>{
 const write=await weight(4);await project.checkCandidate({[blend]:write.text});
 const index='Assets/Documents.index.json',source=await project.read(index);
 await fs.writeFile(path.join(project.root,index),source.text+'\n');
 await assert.rejects(()=>project.save(write),/外部修改/);await fs.writeFile(path.join(project.root,index),source.text);
 const moduleFile=path.join(project.root,'Editor','Workspace.lua'),module=await fs.readFile(moduleFile,'utf8'),starts=project.validator.stats.starts;
 try{await fs.writeFile(moduleFile,module+'\n');const result=await project.checkCandidate({[blend]:write.text});assert.deepEqual(result.issues,[]);assert.equal(project.validator.stats.starts,starts+1);}
 finally{await fs.writeFile(moduleFile,module);await project.synchronize();}
});

test('failed second atomic write rolls back the first and retains both drafts for retry',async()=>{
 const first=await project.read(blend),second=await project.read(rig),data=JSON.parse(second.text);data.Description='rollback test';
 const store=new Documents(project),a=await store.ensure(blend),b=await store.ensure(rig),atomic=project.atomic;
 store.editText({path:blend,baseText:a.text,text:(await weight(5)).text});store.editText({path:rig,baseText:b.text,text:encode(data)});
 let writes=0;project.atomic=async function(...args){if(++writes===2)throw Error('injected write failure');return atomic.apply(this,args);};
 const request={paths:[blend,rig],versions:{[blend]:a.version,[rig]:b.version}};
 try{await assert.rejects(()=>store.save(request),/injected/);assert.equal((await project.read(blend)).text,first.text);assert.equal((await project.read(rig)).text,second.text);assert.equal(store.state().docs.filter(d=>d.dirty).length,2);
  project.atomic=atomic;assert.equal((await store.save(request)).saved,2);
 }finally{project.atomic=atomic;store.close();}
});

test('worker restart and explicit full validation preserve exact project rules',async()=>{
 project.proofs.clear();project.validator.child.kill();await new Promise(resolve=>project.validator.child.once('close',resolve));
 const before=project.validator.stats.starts,result=await project.checkCandidate({[blend]:(await weight(6)).text});assert.deepEqual(result.issues,[]);assert.equal(project.validator.stats.starts,before+1);
 const full=await project.validate();assert.deepEqual(full.issues,[]);assert.equal(full.checked,(await project.getSnapshot()).assets.length);
});

test('late validation replies never update a newer draft version',async()=>{
 const pending=[],fake={epoch:1,read:async file=>({path:file,text:'{"x":1}',revision:'disk'}),checkCandidate:()=>new Promise(resolve=>pending.push(resolve))};
 const store=new Documents(fake),doc=await store.ensure('Assets/Test.curve');
 store.editField({path:doc.path,parts:['x'],baseValue:1,value:2});const old=store.validateDrafts();
 store.editField({path:doc.path,parts:['x'],baseValue:2,value:3});pending.shift()({issues:[],epoch:1});await old;assert.equal(doc.validation.status,'pending');
 const current=store.validateDrafts();pending.shift()({issues:[],epoch:1});await current;assert.equal(doc.validation.status,'valid');assert.equal(doc.validation.version,2);store.close();
});

test('renderer keeps unchanged parsed assets stable through session updates',async()=>{
 const {draftAssetView}=await import('../src/draftAssets.mjs'),view=draftAssetView(),assets=(await project.getSnapshot()).assets;
 const text=encode({...assets[0].data,Description:'draft'}),docs=[{path:assets[0].path,text,dirty:true,version:1}];
 const first=view(assets,docs),second=view(assets,docs.map(d=>({...d,validation:{status:'valid'}})));
 assert.equal(first[0],second[0]);assert.equal(first[1],assets[1]);assert.equal(second[1],assets[1]);
 assert.equal(view(assets,[])[0],assets[0]);
});
