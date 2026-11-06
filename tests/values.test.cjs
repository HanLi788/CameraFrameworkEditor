const {test,before}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs');
let project;
before(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-value-editor-'));const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/MyWorks/Lua/CameraFramework';await fs.cp(source,path.join(dir,'CameraFramework'),{recursive:true});await fs.cp(path.join(path.dirname(source),'Foundation'),path.join(dir,'Foundation'),{recursive:true});project=await Project.open(path.join(dir,'CameraFramework'),path.join(dir,'data'),path.resolve('runtime/lua54.exe'));});
test('target slots recognize value references and reject references of another type',async()=>{
  const snap=await project.snapshot(),asset=snap.assets.find(a=>a.path==='Assets/CameraAssets/InteractiveCamera/Player/Dialogue/InputAssets/Enter.input');
  assert.equal(asset.refs.length,2);assert.ok(asset.refs.every(r=>r.type==='Value'));
  const doc=await project.read(asset.path),data=JSON.parse(doc.text);data.ValueAssets[0].Path='Assets/CurveAssets/Bezier/Linear.curve';
  await assert.rejects(()=>project.save({...doc,text:encode(data)}),/Value/);assert.equal((await project.read(doc.path)).text,doc.text);
});
test('duplicate slot keys and legacy schemas cannot be saved, optional keys are valid',async()=>{
  const a=(await project.snapshot()).assets.find(a=>a.path==='Assets/CameraAssets/InteractiveCamera/Player/Dialogue/InputAssets/Enter.input'),doc=await project.read(a.path);
  for(const mutate of [d=>d.ValueAssets[1].Id=d.ValueAssets[0].Id,d=>d.ValueAssets=[],d=>d.SchemaVersion=2,d=>d.Channels={},d=>d.bTargetsById=true]){
    const data=JSON.parse(doc.text);mutate(data);await assert.rejects(()=>project.save({...doc,text:encode(data)}));assert.equal((await project.read(doc.path)).text,doc.text);
  }
  const data=JSON.parse(doc.text);delete data.ValueAssets[0].Id;data.ValueAssets[1].Id='10001';data.ValueAssets.reverse();
  const saved=await project.save({...doc,text:encode(data)});assert.equal(JSON.parse(saved.text).ValueAssets[0].Id,'10001');await project.save({...saved,text:doc.text});
});
test('value assets can be cloned and moved with explicit path references; referenced values cannot be deleted',async()=>{
  let snap=await project.snapshot();const a=snap.assets.find(a=>a.type==='Value'),relative='Assets/Custom/ValueAssets/新机位.value';
  await project.mutate({kind:'copy',sourcePath:a.path,path:relative,snapshotRevision:snap.snapshotRevision});
  const doc=await project.read(relative);assert.equal(Object.keys(JSON.parse(doc.text).Channels).length,12);
  snap=await project.snapshot();await project.mutate({kind:'move',sourcePath:relative,path:'Assets/Elsewhere/renamed.value',sourceRevision:doc.revision,snapshotRevision:snap.snapshotRevision});
  snap=await project.snapshot();assert.equal(snap.assets.find(a=>a.path==='Assets/Elsewhere/renamed.value').path,'Assets/Elsewhere/renamed.value');
  await assert.rejects(async()=>project.mutate({kind:'delete',sourcePath:a.path,snapshotRevision:snap.snapshotRevision,sourceRevision:(await project.read(a.path)).revision}),/引用/);
  const moved=await project.read('Assets/Elsewhere/renamed.value');await project.mutate({kind:'delete',sourcePath:'Assets/Elsewhere/renamed.value',snapshotRevision:snap.snapshotRevision,sourceRevision:moved.revision});
});
test('saving a target validates every channel and leaves referring input files unchanged',async()=>{
  const snap=await project.snapshot(),input=snap.assets.find(a=>a.path==='Assets/CameraAssets/ActionCamera/Player/Dash/InputAssets/Enter.input'),parent=await project.read(input.path);
  const target=snap.assets.find(a=>a.path===input.data.ValueAssets[0].Path),doc=await project.read(target.path),bad=JSON.parse(doc.text);
  bad.Channels.FOV.bEnabled=false;bad.Channels.FOV.Value=180;await assert.rejects(()=>project.save({...doc,text:encode(bad)}));assert.equal((await project.read(doc.path)).text,doc.text);
  const data=JSON.parse(doc.text);data.Channels.Dist.Value+=10;const saved=await project.save({...doc,text:encode(data)});assert.equal((await project.read(parent.path)).text,parent.text);await project.save({...saved,text:doc.text});
});
