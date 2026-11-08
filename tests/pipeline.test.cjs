const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs');
let project;
const file='Assets/CameraAssets/ActionCamera/Player/Run/PipelineAssets/Run_Default.pipeline';
before(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-pipeline-v3-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 project=await Project.open(dir,path.join(dir,'data'),path.resolve('runtime/lua54.exe'));
});
test('pipeline v3 rejects legacy options, unknown stage fields and old schema without writing',async()=>{
 const doc=await project.read(file),original=JSON.parse(doc.text),{pipelineProblems}=await import('../src/pipelineModel.mjs');
 assert.equal(original.SchemaVersion,3);
 for(const mutate of [d=>d.SchemaVersion=2,d=>d.Stages.Input.Options={},d=>d.Stages.Input.Options={IMCName:'Other'},d=>d.Stages.Smooth.Options={ControlProvider:'Fake'},d=>d.Stages.Input.IMCName='Other']){
  const data=structuredClone(original);mutate(data);assert.ok(pipelineProblems(data).length);
  await assert.rejects(()=>project.save({...doc,text:encode(data)}));assert.equal((await project.read(file)).text,doc.text);
 }
});
test('pipeline copies and valid order edits retain implementation-only stages and user input IMC',async()=>{
 const snap=await project.snapshot(),sourceInput=snap.assets.find(a=>a.type==='Input'&&a.data.Type==='UserInput'),inputBefore=await project.read(sourceInput.path);
 const copyPath='Assets/Test/Shared.pipeline';await project.mutate({kind:'copy',sourcePath:file,path:copyPath,snapshotRevision:snap.snapshotRevision});
 const doc=await project.read(copyPath),data=JSON.parse(doc.text);[data.Flow[0],data.Flow[1]]=[data.Flow[1],data.Flow[0]];
 const saved=await project.save({...doc,text:encode(data)}),result=JSON.parse(saved.text);
 assert.equal(result.SchemaVersion,3);assert.ok(Object.values(result.Stages).every(s=>Object.keys(s).join(',')==='Implementation'));
 assert.equal((await project.read(sourceInput.path)).text,inputBefore.text);assert.ok(JSON.parse(inputBefore.text).IMCName);
});
