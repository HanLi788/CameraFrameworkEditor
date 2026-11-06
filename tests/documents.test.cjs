const {test,before}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs');
const {Documents}=require('../electron/documents.cjs');
let p,store,snap,temp;
before(async()=>{temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-editor-shared-'));const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/MyWorks/Lua/CameraFramework';await fs.cp(source,path.join(temp,'CameraFramework'),{recursive:true});await fs.cp(path.join(path.dirname(source),'Foundation'),path.join(temp,'Foundation'),{recursive:true});p=await Project.open(path.join(temp,'CameraFramework'),path.join(temp,'data'),path.resolve('runtime/lua54.exe'));store=new Documents(p);snap=await p.snapshot();console.log('Shared-document fixture:',temp);});
const rigPath='Assets/CameraAssets/ActionCamera/Player/Dash/Dash.rig';
test('creates both curve parent types in a user-chosen directory without a template',async()=>{
  for(const parentType of ['Bezier','CubicHermiteSpline']){const current=await p.snapshot(),relative='Assets/Custom/曲线/'+parentType+'.curve';await p.mutate({kind:'create-curve',path:relative,parentType,snapshotRevision:current.snapshotRevision});const data=JSON.parse((await p.read(relative)).text);assert.equal(data.Id,undefined);assert.equal(data.ParentType,parentType);assert.equal((await p.snapshot()).assets.find(a=>a.path===relative).path,relative);}
  assert.equal((await p.validate()).issues.length,0);
});
test('saving a curve updates the same file without creating assets or changing referencing files',async()=>{
  const a=snap.assets.find(a=>a.path==='Assets/CurveAssets/Bezier/Linear.curve'),d=await store.ensure(a.path);
  const consumers=snap.assets.filter(a=>a.refs.some(r=>r.path==='Assets/CurveAssets/Bezier/Linear.curve'));const originals=await Promise.all(consumers.map(a=>p.read(a.path)));
  const data=JSON.parse(d.text);data.P2.Y=.2;store.editText({path:d.path,baseText:d.text,text:encode(data)});const result=await store.save({paths:[d.path],versions:{[d.path]:d.version}});
  assert.equal(result.saved,1);assert.equal(JSON.parse((await p.read(d.path)).text).P2.Y,.2);assert.equal(store.isDirty(d),false);
  for(const old of originals)assert.equal((await p.read(old.path)).text,old.text);
});
test('replacing a curve reference saves only the parent and leaves curve definitions unchanged',async()=>{
  const a=snap.assets.find(a=>a.path==='Assets/CameraAssets/ActionCamera/Player/Dash/SmoothAssets/Default.smooth'),d=await store.ensure(a.path),parts=['Channels','Dist','ResponseCurve'],sourcePath=JSON.parse(d.text).Channels.Dist.ResponseCurve;
  const sources=await Promise.all(['Assets/CurveAssets/Bezier/Linear.curve',sourcePath].map(file=>p.read(file)));
  store.editField({path:d.path,parts,value:'Assets/CurveAssets/Bezier/Linear.curve',baseValue:sourcePath});await store.save({paths:[d.path],versions:{[d.path]:d.version}});
  assert.equal(JSON.parse((await p.read(d.path)).text).Channels.Dist.ResponseCurve,'Assets/CurveAssets/Bezier/Linear.curve');for(const old of sources)assert.equal((await p.read(old.path)).text,old.text);
});
test('invalid shared curve edits are rejected with no disk change and keep the draft',async()=>{
  const a=snap.assets.find(a=>a.path==='Assets/CurveAssets/Bezier/Linear.curve'),d=await store.ensure(a.path),before=await p.read(d.path),data=JSON.parse(d.text);data.P4.Y=0;
  store.editText({path:d.path,baseText:d.text,text:encode(data)});await assert.rejects(()=>store.save({paths:[d.path],versions:{[d.path]:d.version}}));assert.equal((await p.read(d.path)).text,before.text);assert.equal(store.isDirty(d),true);store.discard(d.path);
});
test('external changes block normal curve saves and preserve local edits',async()=>{
  const a=snap.assets.find(a=>a.path==='Assets/CurveAssets/CubicHermiteSpline/RangeSoftEdge.curve'),d=await store.ensure(a.path),original=await p.read(d.path),next=JSON.parse(d.text);next.Points[1].Y=.2;
  store.editText({path:d.path,baseText:d.text,text:encode(next)});await fs.writeFile(path.join(p.root,d.path),original.text+'\n');await assert.rejects(()=>store.save({paths:[d.path],versions:{[d.path]:d.version}}),/外部修改/);assert.equal(store.isDirty(d),true);await fs.writeFile(path.join(p.root,d.path),original.text);store.discard(d.path);
});
test('new curve collision and unsupported types leave files unchanged',async()=>{
  const current=await p.snapshot();await assert.rejects(()=>p.mutate({kind:'create-curve',path:'Assets/BadType.curve',parentType:'Gaussian',snapshotRevision:current.snapshotRevision}),/父类型/);
  await assert.rejects(()=>p.mutate({kind:'create-curve',path:'Assets/Custom/曲线/Bezier.curve',parentType:'Bezier',snapshotRevision:current.snapshotRevision}),/已存在/);
  assert.equal((await p.snapshot()).snapshotRevision,current.snapshotRevision);
});
test('shared field patches merge different-window edits and reject stale same-field writes',async()=>{
  const a=snap.assets.find(a=>a.path.endsWith('/Dash/InputAssets/User.input')),d=await store.ensure(a.path),before=JSON.parse(d.text);
  const first=['Channels','Yaw','Weight'],second=['Channels','Pitch','Weight'];
  store.editField({path:d.path,parts:first,value:-2,baseValue:before.Channels.Yaw.Weight});
  store.editField({path:d.path,parts:second,value:-3,baseValue:before.Channels.Pitch.Weight});
  assert.equal(JSON.parse(d.text).Channels.Yaw.Weight,-2);assert.equal(JSON.parse(d.text).Channels.Pitch.Weight,-3);
  assert.throws(()=>store.editField({path:d.path,parts:first,value:5,baseValue:2}),/其他窗口/);
  store.history(d.path);assert.equal(JSON.parse(d.text).Channels.Pitch.Weight,2);store.discard(d.path);
});
