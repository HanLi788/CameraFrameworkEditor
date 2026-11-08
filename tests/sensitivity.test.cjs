const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs');
let project;
const input='Assets/CameraAssets/ActionCamera/Player/Run/InputAssets/Run_User.input',sensitivity='Assets/CameraAssets/ActionCamera/Player/Run/SensitivityAssets/Run_Default.sensitivity',rig='Assets/CameraAssets/ActionCamera/Player/Run/Run.rig',unit='Assets/CurveAssets/CubicHermiteSpline/RangeUnit.curve';
before(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-sensitivity-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 project=await Project.open(dir,path.join(dir,'data'),path.resolve('runtime/lua54.exe'));
});
test('direction sensitivity owns twelve channels; input owns mounts; graph and shared owners follow both references',async()=>{
 const snap=await project.snapshot(),a=snap.assets.find(a=>a.path===sensitivity),i=snap.assets.find(a=>a.path===input),r=snap.assets.find(a=>a.path===rig);
 assert.equal(a.data.SchemaVersion,3);assert.equal(Object.keys(a.data.Channels).length,12);assert.equal(a.refs.length,24);assert.ok(a.refs.every(r=>r.path===unit&&r.type==='Curve'));
 assert.equal(i.data.SchemaVersion,5);assert.deepEqual(i.data.SensitivityAssets,[sensitivity]);assert.ok(i.refs.some(r=>r.path===sensitivity&&r.field==='SensitivityAssets.0'));
 assert.equal(r.data.SchemaVersion,15);assert.equal(r.data.Processors.Input.SensitivityAssets,undefined);
 const {rigOwners}=await import('../src/rigGraph.mjs');assert.ok(rigOwners(snap.assets).get(sensitivity.toLowerCase()).includes(rig));
 assert.equal(i.data.Channels.Yaw.Weight,undefined);assert.equal(typeof i.data.Channels.Yaw.DefaultSensitivity,'number');
});
test('legacy sensitivity fields, legacy input weights and zero return curves cannot be saved',async()=>{
 for(const [file,mutations] of [[sensitivity,[d=>d.SchemaVersion=2,d=>d.RangeAsset='Assets/Fake.range',d=>delete d.Channels.Roll,d=>d.Channels.Yaw.DeadZone=0,d=>d.Channels.Yaw.FreeZone={Min:0,Max:1},d=>d.Channels.Yaw.SensitivityRange={Min:0,Max:1},d=>d.Channels.Yaw.ReturnCurve='Assets/CurveAssets/CubicHermiteSpline/RangeLinearEdge.curve']],
  [input,[d=>d.SchemaVersion=4,d=>d.Channels.Yaw.Weight=1,d=>delete d.SensitivityAssets,d=>d.SensitivityAssets.push(sensitivity)]],
  [rig,[d=>d.Processors.Input.SensitivityAssets=[],d=>d.SchemaVersion=14]]]){
  const doc=await project.read(file);for(const mutate of mutations){const data=JSON.parse(doc.text);mutate(data);await assert.rejects(()=>project.save({...doc,text:encode(data)}));assert.equal((await project.read(file)).text,doc.text);}
 }
});
test('new channels save and sensitivity/curve moves rewrite input and both direction references',async()=>{
 const doc=await project.read(sensitivity),data=JSON.parse(doc.text);data.Channels.FOV.bEnabled=true;data.Channels['AnchorLocOffset.X'].bEnabled=true;
 await project.save({...doc,text:encode(data)});
 const curve='Assets/Custom/Direction.curve';await project.mutate({kind:'copy',sourcePath:unit,path:curve,snapshotRevision:(await project.snapshot()).snapshotRevision});
 data.Channels.FOV.EscapeCurve=curve;data.Channels.FOV.ReturnCurve=curve;await project.save({...await project.read(sensitivity),text:encode(data)});
 const movedCurve='Assets/Custom/Moved.curve';await project.mutate({kind:'move',sourcePath:curve,sourceRevision:(await project.read(curve)).revision,path:movedCurve,snapshotRevision:(await project.snapshot()).snapshotRevision});
 const current=JSON.parse((await project.read(sensitivity)).text);assert.equal(current.Channels.FOV.EscapeCurve,movedCurve);assert.equal(current.Channels.FOV.ReturnCurve,movedCurve);
 const moved='Assets/Custom/Moved.sensitivity';await project.mutate({kind:'move',sourcePath:sensitivity,sourceRevision:(await project.read(sensitivity)).revision,path:moved,snapshotRevision:(await project.snapshot()).snapshotRevision});assert.deepEqual(JSON.parse((await project.read(input)).text).SensitivityAssets,[moved]);
 const snap=await project.snapshot(),docNow=await project.read(moved);await assert.rejects(()=>project.mutate({kind:'delete',sourcePath:moved,sourceRevision:docNow.revision,snapshotRevision:snap.snapshotRevision}),/引用/);assert.equal((await project.validate()).issues.length,0);
});
