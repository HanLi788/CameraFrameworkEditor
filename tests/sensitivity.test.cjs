const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs');
let project;
const input='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Run/InputAssets/Run_User.userInput',sensitivity='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Run/SensitivityAssets/Run_Default.sensitivity',rig='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Run/Run.rig',unit='Assets/Shared/CurveAssets/CubicHermiteSpline/RangeUnit.curve';
before(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-sensitivity-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/cslua3/ue5cs/cslua/Content/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem','EventBus'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 project=await Project.open(dir,path.join(dir,'data'),path.resolve('runtime/lua54.exe'));
});
test('direction sensitivity owns twelve channels; input owns mounts; graph and shared owners follow both references',async()=>{
 const snap=await project.snapshot(),a=snap.assets.find(a=>a.path===sensitivity),i=snap.assets.find(a=>a.path===input),r=snap.assets.find(a=>a.path===rig);
 assert.equal(a.data.SchemaVersion,1);assert.equal(Object.keys(a.data.Channels).length,15);assert.equal(a.refs.length,30);assert.ok(a.refs.every(r=>r.path===unit&&r.type==='Curve'));
 assert.equal(i.data.SchemaVersion,1);assert.deepEqual(i.data.SensitivityAssets,[sensitivity.slice(7)]);assert.ok(i.refs.some(r=>r.path===sensitivity&&r.field==='SensitivityAssets.0'));
 assert.equal(r.data.SchemaVersion,1);assert.equal(r.data.Processors.Input.SensitivityAssets,undefined);
 const {rigOwners}=await import('../src/rigGraph.mjs');assert.ok(rigOwners(snap.assets).get(sensitivity.toLowerCase()).includes(rig));
 assert.equal(i.data.Channels.RotationYaw.Weight,undefined);assert.equal(typeof i.data.Channels.RotationYaw.DefaultSensitivity,'number');
});
test('legacy sensitivity fields, legacy input weights and zero return curves cannot be saved',async()=>{
 for(const [file,mutations] of [[sensitivity,[d=>d.SchemaVersion=2,d=>d.RangeAsset='Assets/Fake.range',d=>delete d.Channels.RotationRoll,d=>d.Channels.RotationYaw.DeadZone=0,d=>d.Channels.RotationYaw.FreeZone={Min:0,Max:1},d=>d.Channels.RotationYaw.SensitivityRange={Min:0,Max:1},d=>d.Channels.RotationYaw.ReturnCurve='Shared/CurveAssets/CubicHermiteSpline/RangeLinearEdge.curve']],
  [input,[d=>d.SchemaVersion=4,d=>d.Channels.RotationYaw.Weight=1,d=>delete d.SensitivityAssets,d=>d.Channels.FOV.bEnabled='true']],
  [rig,[d=>d.Processors.Input.SensitivityAssets=[],d=>d.SchemaVersion=14]]]){
  const doc=await project.read(file);for(const mutate of mutations){const data=JSON.parse(doc.text);mutate(data);await assert.rejects(()=>project.save({...doc,text:encode(data)}));assert.equal((await project.read(file)).text,doc.text);}
 }
});
test('new channels save and sensitivity/curve moves rewrite input and both direction references',async()=>{
 const doc=await project.read(sensitivity),data=JSON.parse(doc.text);data.Channels.FOV.bEnabled=true;data.Channels['AnchorOffsetX'].bEnabled=true;
 await project.save({...doc,text:encode(data)});
 const curve='Assets/GameplayCameraSystem/Custom/Direction.curve';await project.mutate({kind:'copy',sourcePath:unit,path:curve,snapshotRevision:(await project.snapshot()).snapshotRevision});
 data.Channels.FOV.EscapeCurve=curve.slice(7);data.Channels.FOV.ReturnCurve=curve.slice(7);await project.save({...await project.read(sensitivity),text:encode(data)});
 const movedCurve='Assets/GameplayCameraSystem/Custom/Moved.curve';await project.mutate({kind:'move',sourcePath:curve,sourceRevision:(await project.read(curve)).revision,path:movedCurve,snapshotRevision:(await project.snapshot()).snapshotRevision});
 const current=JSON.parse((await project.read(sensitivity)).text);assert.equal(current.Channels.FOV.EscapeCurve,movedCurve.slice(7));assert.equal(current.Channels.FOV.ReturnCurve,movedCurve.slice(7));
 const moved='Assets/GameplayCameraSystem/Custom/Moved.sensitivity';await project.mutate({kind:'move',sourcePath:sensitivity,sourceRevision:(await project.read(sensitivity)).revision,path:moved,snapshotRevision:(await project.snapshot()).snapshotRevision});assert.deepEqual(JSON.parse((await project.read(input)).text).SensitivityAssets,[moved.slice(7)]);
 const snap=await project.snapshot(),docNow=await project.read(moved);await assert.rejects(()=>project.mutate({kind:'delete',sourcePath:moved,sourceRevision:docNow.revision,snapshotRevision:snap.snapshotRevision}),/引用/);assert.equal((await project.validate()).issues.length,0);
});
