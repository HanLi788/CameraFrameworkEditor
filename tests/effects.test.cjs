const {test,before}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {Project,encode}=require('../electron/project.cjs');
const {Documents}=require('../electron/documents.cjs');

const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/cslua3/ue5cs/cslua/Content/Lua/CameraFramework';
let project,sets;
const effectPath='Assets/GameplayCameraSystem/EffectAssets/ViewpointVelocity/MovementSpeed.effect';
before(async()=>{
  sets=await import('../src/effectSets.mjs');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-effect-editor-'));
  for(const name of ['CameraFramework','Foundation','InputSystem','EventBus'])await fs.cp(path.join(path.dirname(source),name),path.join(temp,name),{recursive:true});
  for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(temp,'Actor/Player',name+'.lua'));
  project=await Project.open(temp,path.join(temp,'data'),path.resolve('runtime/lua54.exe'));
});
test('form set parsing agrees with Lua on boundaries, unions, constants and invalid expressions',async()=>{
  const inputs=['[0,300] or [600,999) or {500}','[0,300]or[600,999)or{500}','[0,300] or [600,999) ∪ {500}','{0} or {1}','[0,1] or [1,2]',
    'or {1}','{1} or','{1} or or {2}','{1} or ∪ {2}','{1} OR {2}','{1} xor {2}','{1} oror {2}','{1} _or {2}','{1} or2 {2}','false or {1}','{1 or 2}','{1} or os.exit()','[0,300]∪[600,999)∪{500}','{0}∪{1}','(0,1)∪{1}∪(1,2)','[0,1)∪(1,2]',
    '[-9000000000000000000,9000000000000000000]',' { -.5, +1e2 } ','[0,1]∪[1,2]','{5}','[5,5]',
    '', '{}','{1,}','{1,,2}','(1,1)','[2,1]','[0,inf)','{NaN}','{0x10}','{1e2e3}','{os.exit()}',
    '[0,1]|[2,3]','{1}∪','∪{1}','{1}∪ ∪{2}','[-1e308,1e308]',Array(257).fill('{0}').join('∪'),' '.repeat(8193)+'{1}'];
  const cases=inputs.flatMap(text=>[false,true].map(output=>({text,output})));
  const lua=`local S=require('CameraFramework.Shared.NumberSet');local J=require('Foundation.Serialization.JsonReader')
for _,c in ipairs(J.Decode(io.read('*a'))) do local ok,s=pcall(c.output and S.Output or S.Parse,c.text,'Set');if not ok then print('invalid') else io.write(string.format('%.17g,%.17g,%d',s.Min,s.Max,#s.Parts));for _,p in ipairs(s.Parts) do io.write(string.format(';%.17g,%.17g,%s,%s',p.Min,p.Max,tostring(p.Left),tostring(p.Right))) end;io.write('\\n') end end`;
  const result=spawnSync(path.resolve('runtime/lua54.exe'),['-e',lua],{cwd:path.dirname(source),input:JSON.stringify(cases),encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  const lines=result.stdout.trim().split(/\r?\n/);
  for(let i=0;i<cases.length;i++){
    const {text,output}=cases[i];let js;
    try{js=sets.parseEffectSet(text,output);}catch{assert.equal(lines[i],'invalid',text);continue;}
    assert.notEqual(lines[i],'invalid',text);
    const [head,...parts]=lines[i].split(';'),[min,max,count]=head.split(',').map(Number);
    assert.deepEqual([js.min,js.max,js.parts.length],[min,max,count],text);
    assert.deepEqual(js.parts,parts.map(p=>{const [a,b,l,r]=p.split(',');return {min:Number(a),max:Number(b),left:l==='true',right:r==='true'};}),text);
  }
});
test('new output templates handle singleton domains and projects without curves',()=>{
  const curves=[{type:'Curve',path:'Assets/Shared/CurveAssets/Bezier/Linear.curve'}];
  assert.deepEqual(sets.effectOutputTemplate('{1}',curves),{Type:'Scalar',Range:'{0}'});
  assert.deepEqual(sets.effectOutputTemplate('[0,1]',[]),{Type:'Scalar',Range:'{0}'});
  assert.deepEqual(sets.effectOutputTemplate('[0,1]',curves),{Type:'Scalar',Range:'[0,1]',Curve:curves[0].path.slice(7)});
});
test('version ten effects save constant outputs and copy as valid typed assets',async()=>{
  const original=await project.read(effectPath),data=JSON.parse(original.text);
  assert.equal(data.SchemaVersion,1);assert.equal(data.Weight,undefined);
  data.Domain='{0} or {1}';data.Outputs={FOV:{Type:'Scalar',Range:'{5}'},'AnchorOffsetX':{Type:'Scalar',Range:'{-2}'}};
  const saved=await project.save({...original,text:encode(data)});
  assert.deepEqual(JSON.parse(saved.text),data);
  const dest='Assets/GameplayCameraSystem/Custom/Constant.effect',snap=await project.snapshot();
  await project.mutate({kind:'create-asset',type:'Effect',sourcePath:effectPath,path:dest,snapshotRevision:snap.snapshotRevision});
  assert.deepEqual(JSON.parse((await project.read(dest)).text).Outputs,data.Outputs);
  assert.deepEqual((await project.validate()).issues,[]);
  await project.save({...saved,text:original.text});
});
test('real Lua validation rejects old fields, invalid sets and ambiguous mappings without overwriting disk',async()=>{
  const original=await project.read(effectPath);
  for(const change of [v=>v.SchemaVersion=6,v=>v.Weight=1,v=>delete v.Domain,v=>v.Domain='[0,1)∪',
    v=>v.Outputs.FOV.DeadZone={Min:0,Max:1},v=>v.Outputs.FOV.Weight=1,v=>v.Outputs.FOV.Range='{0,1}',
    v=>v.Outputs.FOV.Range='(0,20]',v=>delete v.Outputs.FOV.Curve,v=>v.Domain='{1}']){
    const data=JSON.parse(original.text);change(data);
    await assert.rejects(()=>project.save({...original,text:encode(data)}));
    assert.equal((await project.read(effectPath)).text,original.text);
  }
});
test('shared domain and dotted output edits preserve undo and save through Documents',async()=>{
  const original=await project.read(effectPath),store=new Documents(project),doc=await store.ensure(effectPath),data=JSON.parse(doc.text);
  store.editField({path:doc.path,parts:['Domain'],baseValue:data.Domain,value:'[0,300] or [600,999) or {500}'});
  store.editField({path:doc.path,parts:['Outputs'],baseValue:data.Outputs,value:{'AnchorOffsetX':{Type:'Scalar',Range:'{-5}'}}});
  store.editField({path:doc.path,parts:['Outputs','AnchorOffsetX','Range'],baseValue:'{-5}',value:'{5}'});
  store.history(doc.path);assert.equal(JSON.parse(doc.text).Outputs['AnchorOffsetX'].Range,'{-5}');
  await store.save({paths:[doc.path],versions:{[doc.path]:doc.version}});
  await project.save({...await project.read(effectPath),text:original.text});
});

test('registry is read from workspace Lua, validates declarations and refreshes source changes',async()=>{
 const file=path.join(project.root,'InterfaceRegistry/GameplayCameraSystem/InterfaceRegistry.lua'),original=await fs.readFile(file,'utf8');
 const before=await project.snapshot();assert.ok(before.effectCatalog.objects.find(o=>o.name==='Viewpoint').interfaces.some(i=>i.name==='IsMoving'));assert.equal(before.effectCatalog.channels.length,15);assert.ok(!before.effectCatalog.channels.includes('ExposureCompensation'));
 try{
  await fs.writeFile(file,original.replace('GetSpeedValue = {','CustomNumber = {bMemberFunction=false,ReturnType="number",Params={{Name="Gain",Type="number",Min=0,Max=2,Default=1}}},\n        GetSpeedValue = {'));
  const changed=await project.snapshot();assert.notEqual(changed.snapshotRevision,before.snapshotRevision);assert.ok(changed.effectCatalog.objects.find(o=>o.name==='Viewpoint').interfaces.some(i=>i.name==='CustomNumber'));
  await fs.writeFile(file,original.replace('Viewpoint = {','Typo = {'));assert.ok((await project.validate()).issues.some(i=>i.message.includes('Viewpoint')));
  await fs.writeFile(file,original.replace('ReturnType = "number"','ReturnType = "string"'));assert.ok((await project.snapshot()).issues.some(i=>i.message.includes('number / boolean')));
 }finally{await fs.writeFile(file,original);}
});
test('save enforces registered source, parameter schema and boolean domain including source edits',async()=>{
 const original=await project.read(effectPath);
 for(const change of [v=>v.Source.bMemberFunction=true,v=>v.Source.Interface='Typo',v=>v.Source.Object='Viewpoint.Child',v=>v.Source.Params=[1],v=>v.Source={Object:'Viewpoint',Interface:'GetVelocityComponentValue',Params:['Q']},v=>{v.Source={Object:'Viewpoint',Interface:'IsMoving',Params:[]};v.Domain='[0,1]';}]){
  const data=JSON.parse(original.text);change(data);await assert.rejects(()=>project.save({...original,text:encode(data)}));assert.equal((await project.read(effectPath)).text,original.text);
 }
 const data=JSON.parse(original.text);data.Source={Object:'Viewpoint',Interface:'IsMoving',Params:[]};data.Domain='{0} or {1}';await project.save({...original,text:encode(data)});await project.save({...await project.read(effectPath),text:original.text});
});
