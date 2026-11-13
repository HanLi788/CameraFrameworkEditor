const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./framework-fixture.cjs'),{encode}=require('../electron/project.cjs');let project;
before(async()=>{project=await fixture();});
const base='Assets/GameplayCameraSystem/CameraAssets/InteractiveCamera/Dialogue/',focus=base+'InputAssets/Dialogue_Focus.transitionInput',unfocus=base+'InputAssets/Dialogue_Unfocus.transitionInput';
const saveInvalid=async(doc,data)=>{await assert.rejects(()=>project.save({...doc,text:encode(data)}));assert.equal((await project.read(doc.path)).text,doc.text);};

test('Focus and Unfocus expose transitionValue paths including the explicit default reference',async()=>{
 const snapshot=await project.snapshot(),f=snapshot.assets.find(a=>a.path===focus),u=snapshot.assets.find(a=>a.path===unfocus);
 assert.ok(f.data.ValueAssets.length);assert.ok(f.refs.every(r=>r.type==='Value'));assert.equal(u.data.ValueAssets.length,0);assert.ok(u.refs.some(r=>r.field==='DefaultValueAsset'&&r.type==='Value'));assert.deepEqual((await project.validate()).issues,[]);
 const doc=await project.read(focus),bad=JSON.parse(doc.text);bad.ValueAssets[0]='Shared/CurveAssets/Bezier/Linear.curve';await saveInvalid(doc,bad);
});

test('Focus requires unique targets, forbids defaults and rejects the old keyed target protocol',async()=>{
 const doc=await project.read(focus),original=JSON.parse(doc.text),defaultKey=JSON.parse((await project.read(unfocus)).text).DefaultValueAsset;
 for(const change of [d=>d.ValueAssets=[],d=>d.ValueAssets=[d.ValueAssets[0],d.ValueAssets[0]],d=>d.ValueAssets=[{Id:10001,Path:d.ValueAssets[0]}],d=>d.DefaultValueAsset=defaultKey,d=>d.ValueAssets=[defaultKey]]){const data=structuredClone(original);change(data);await saveInvalid(doc,data);}
});

test('Unfocus requires a default without PerformanceType and allows an empty specialized list',async()=>{
 const doc=await project.read(unfocus),data=JSON.parse(doc.text),f=JSON.parse((await project.read(focus)).text);
 await saveInvalid(doc,{...data,DefaultValueAsset:f.ValueAssets[0]});const noDefault={...data};delete noDefault.DefaultValueAsset;await saveInvalid(doc,noDefault);
 const target=await project.read('Assets/'+data.DefaultValueAsset);await saveInvalid(target,{...JSON.parse(target.text),PerformanceType:{BaseName:'PERFORMANCE_NPC'}});
 assert.deepEqual((await project.validate()).issues,[]);
});

test('structured performance identities reject invalid bases, numeric codes, null and old strings',async()=>{
 const input=JSON.parse((await project.read(focus)).text),doc=await project.read('Assets/'+input.ValueAssets[0]),value=JSON.parse(doc.text);
 for(const performance of ['PERFORMANCE_NPC_10001',[],{}, {BaseName:'NPC'}, {BaseName:'PERFORMANCE_NPC',CodeName:10001},{BaseName:'PERFORMANCE_NPC',CodeName:null},{BaseName:'PERFORMANCE_NPC',CodeName:''},{BaseName:'PERFORMANCE_NPC',CodeName:' '},{BaseName:'PERFORMANCE_NPC',Extra:true}])await saveInvalid(doc,{...value,PerformanceType:performance});
});

test('identity uniqueness compares the exact pair and preserves leading zeros',async()=>{
 const targets=JSON.parse((await project.read(focus)).text).ValueAssets,first=await project.read('Assets/'+targets[0]),second=await project.read('Assets/'+targets[1]),a=JSON.parse(first.text),b=JSON.parse(second.text);
 await saveInvalid(second,{...b,PerformanceType:a.PerformanceType});
 const changed={...a,PerformanceType:{...a.PerformanceType,CodeName:'010001'}};const saved=await project.save({...first,text:encode(changed)});assert.equal(JSON.parse(saved.text).PerformanceType.CodeName,'010001');assert.deepEqual((await project.validate()).issues,[]);await project.save({...saved,text:first.text});
});

test('performance code strings are literals during validation and transactional asset moves',async()=>{
 const targetKey=JSON.parse((await project.read(focus)).text).ValueAssets[0],doc=await project.read('Assets/'+targetKey),value=JSON.parse(doc.text),literal='Shared/CurveAssets/Bezier/Linear.curve';
 const saved=await project.save({...doc,text:encode({...value,PerformanceType:{...value.PerformanceType,CodeName:literal}})});
 const source='Assets/'+literal,destination='Assets/Shared/CurveAssets/Bezier/LiteralTest.curve';
 const move=async(from,to)=>project.mutate({kind:'move',sourcePath:from,path:to,sourceRevision:(await project.read(from)).revision,snapshotRevision:(await project.snapshot()).snapshotRevision});
 await move(source,destination);assert.equal(JSON.parse((await project.read(doc.path)).text).PerformanceType.CodeName,literal);assert.deepEqual((await project.validate()).issues,[]);await move(destination,source);await project.save({...await project.read(doc.path),text:doc.text});
});

test('transition values have fifteen channels; value edits leave their mounting input unchanged',async()=>{
 const input=await project.read('Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/InputAssets/Dash_Focus.transitionInput'),target=await project.read('Assets/'+JSON.parse(input.text).ValueAssets[0]),data=JSON.parse(target.text);assert.equal(Object.keys(data.Channels).length,15);
 const bad=structuredClone(data);bad.Channels.FOV.bEnabled=false;bad.Channels.FOV.Value=180;await saveInvalid(target,bad);
 data.Channels.Distance.Value+=10;const saved=await project.save({...target,text:encode(data)});assert.equal((await project.read(input.path)).text,input.text);await project.save({...saved,text:target.text});
});

test('old switch asset suffixes are diagnosed rather than silently ignored',async()=>{
 for(const suffix of ['.switchViewpointInput','.switchViewpointValue']){
  const relative='Assets/GameplayCameraSystem/Old'+suffix,file=path.join(project.root,relative);await fs.writeFile(file,encode({SchemaVersion:1,Name:'Old'}));
  try{assert.ok((await project.snapshot()).issues.some(i=>i.path===relative&&i.message.includes('已移除')));assert.ok((await project.validate()).issues.some(i=>i.path===relative));}finally{await fs.unlink(file);}
 }
});
