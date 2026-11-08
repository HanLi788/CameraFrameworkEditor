const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
function lua(script,cases){const result=spawnSync(path.resolve('runtime/lua54.exe'),['-e',script],{cwd:process.env.CAMERA_FRAMEWORK_TEST_ROOT?path.dirname(process.env.CAMERA_FRAMEWORK_TEST_ROOT):'D:/MyWorks/Lua',input:JSON.stringify(cases),encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim().split(/\r?\n/).map(s=>s==='true');}
test('value types, references and numeric limits agree with actual Lua channel validation',async()=>{
 const {rangeChannels}=await import('../src/rangeChannels.mjs'),{valueTypes,valueReferences,valueError,changeReference}=await import('../src/valueChannels.mjs');const cases=[],expected=[];
 for(const [name] of rangeChannels)for(const kind of ['Scalar','Angle','Point','Displacement'])for(const reference of ['Absolute','TransitionStart','World','Owner','CurrentTarget','CameraTarget','CameraRender','IdleDefault','IdleCurrent','Explicit'])for(const n of [-1,0,1,180]){
  const channel=changeReference({ValueType:kind,Value:['Point','Displacement'].includes(kind)?[n,2,3]:n,Sample:'EveryFrame',Curve:'Curve',bEnabled:true},reference);
  cases.push({name,channel});expected.push(valueTypes(name).includes(kind)&&valueReferences(kind).includes(reference)&&(!['Scalar','Angle'].includes(kind)||!valueError(name,reference,n)));
 }
 const answers=lua(`require('CameraFramework.Test.Fakes.CameraAdapters').Install();local D=require('CameraFramework.CameraSystem.Values.AssetDefinition');local J=require('Foundation.Serialization.JsonReader');for _,c in ipairs(J.Decode(io.read('*a'))) do print(tostring(pcall(D.ValidateChannel,c.channel,c.name,'Test',false))) end`,cases);
 assert.equal(answers.length,cases.length);cases.forEach((c,i)=>assert.equal(expected[i],answers[i],JSON.stringify(c)));
});
test('pipeline ordering and enable rules agree with Lua implementation requirements',async()=>{
 const {pipelineProblems,toggleStage}=await import('../src/pipelineModel.mjs');const fs=require('node:fs');const root=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 const base=JSON.parse(fs.readFileSync(path.join(root,'Assets/CameraAssets/ActionCamera/Player/Run/PipelineAssets/Run_Default.pipeline'),'utf8')),battle=JSON.parse(fs.readFileSync(path.join(root,'Assets/CameraAssets/BattleCamera/Player/LockTarget/PipelineAssets/LockTarget_Default.pipeline'),'utf8'));
 const permutations=a=>a.length?a.flatMap((x,i)=>permutations(a.filter((_,n)=>n!==i)).map(rest=>[x,...rest])):[[]];
 const cases=permutations(base.Flow).map(Flow=>({...base,Flow}));
 for(const data of [base,battle])for(const name of Object.keys(data.Stages))for(const enabled of [false,true])cases.push(toggleStage(data,name,enabled));
 cases.push({...battle,Flow:['Evaluation','Subject','Input','Effects','Render','Smooth']},{...base,Flow:[],Disabled:Object.keys(base.Stages)},{...base,Flow:[...base.Flow,'Input']});
 const answers=lua(`require('CameraFramework.Test.Fakes.CameraAdapters').Install();local J=require('Foundation.Serialization.JsonReader');local L=require('CameraFramework.CameraSystem.Pipeline.AssetLibrary');local B=require('CameraFramework.CameraSystem.CameraSpaces.BattleCamera.PipelineRules');for _,c in ipairs(J.Decode(io.read('*a'))) do local library={Get=function() return c end};local env=c.SpaceType=='Battle' and B.Environment() or {SpaceType=c.SpaceType};print(tostring(pcall(L.Resolve,'Test',env,library))) end`,cases);
 assert.equal(answers.length,cases.length);cases.forEach((c,i)=>assert.equal(pipelineProblems(c).length===0,answers[i],JSON.stringify(c.Flow)));
});
