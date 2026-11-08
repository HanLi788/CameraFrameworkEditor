const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs');
const {Documents}=require('../electron/documents.cjs');
const {LiveDebug}=require('../electron/live-debug.cjs');
const {LuaPreview}=require('../electron/simulation.cjs');
let temp,project,store;
const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
before(async()=>{
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-live-debug-'));
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(temp,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues','CameraRuntimeDebug'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(temp,'Actor/Player',name+'.lua'));
 project=await Project.open(temp,path.join(temp,'data'),path.resolve('runtime/lua54.exe'));store=new Documents(project);
});
after(()=>console.log('Live-debug fixture:',temp));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){const deadline=Date.now()+20000;while(!await fn()){if(Date.now()>deadline)throw Error('live-debug timeout');await sleep(20);}}
async function request(service,id=service.session+'-123456-1'){
 await fs.writeFile(path.join(service.directory,id+'.request.json'),JSON.stringify({SchemaVersion:1,Session:service.session,RequestId:id,Status:'Requested'}));
 await until(async()=>!!await fs.stat(path.join(service.directory,id+'.result.json')).catch(()=>null));
 return JSON.parse(await fs.readFile(path.join(service.directory,id+'.result.json'),'utf8'));
}
function luaClient(){
 const root=JSON.stringify(project.root.replaceAll('\\','/')),workspace=JSON.stringify(temp.replaceAll('\\','/'));
 const script=`package.path=${workspace}..'/?.lua;'..package.path
package.loaded['Foundation.Adaptation.UETool']={
ReadText=function(p) local f=io.open(p,'rb');if not f then return false end local text=f:read('*a');f:close();return true,text end,
OverwriteText=function(p,text) local f=assert(io.open(p,'wb'));f:write(text);f:close();return true end}
package.loaded['CameraFramework.Shared.AssetLoading.AssetPaths']={GetRootDirectory=function() return ${root} end}
local client=require('Actor.Player.CameraRuntimeDebug').New()
assert(client:RequestSave())
io.write('PREVIEW:{"ready":true}\\n');io.flush()
for line in io.lines() do
 local result=client:Update(.2)
 if result then client:CompleteReload(result.Status=='Saved') end
 io.write('PREVIEW:{"status":"'..(result and result.Status or 'Pending')..'"}\\n');io.flush()
end`;
 return new LuaPreview(project.runtime,script);
}
test('background save flushes all documents and the real Lua client reloads only after success',async()=>{
 const file='Assets/CameraAssets/ActionCamera/Player/Run/InputAssets/Run_User.input',doc=await store.ensure(file);
 const data=JSON.parse(doc.text);data.Channels.Dist.DefaultSensitivity+=1;
 let flushed=false;
 const service=new LiveDebug(project,store,{flush:async()=>{flushed=true;store.editText({path:file,baseText:doc.text,text:encode(data)});}});
 let child;
 try{
  await service.start();child=luaClient();await child.ready;
  await until(()=>service.status==='waiting');assert.equal(flushed,true);
  assert.equal(JSON.parse((await project.read(file)).text).Channels.Dist.DefaultSensitivity,data.Channels.Dist.DefaultSensitivity);
  assert.equal(store.state().docs.find(d=>d.path===file).dirty,false);
  assert.equal((await child.request({kind:'poll'})).status,'Saved');
  await service.scan();await until(()=>service.status==='reloaded');
  assert.equal((await child.request({kind:'poll'})).status,'Pending');
 }finally{child?.destroy();await service.stop();}
});
test('invalid drafts return failure to Lua, retain drafts and leave asset/plan files unchanged',async()=>{
 const file='Assets/CameraAssets/ActionCamera/Player/Run/Run.rig',doc=await store.ensure(file),before=await project.read(file);
 const plan=await project.read('Assets/PostProcessingAssets/Framework.postProcessingPlan');
 store.editText({path:file,baseText:doc.text,text:'{invalid'});
 const service=new LiveDebug(project,store);let child;
 try{
  await service.start();child=luaClient();await child.ready;await until(()=>service.status==='error');
  assert.equal((await child.request({kind:'poll'})).status,'Failed');
  assert.equal((await project.read(file)).text,before.text);
  assert.equal((await project.read(plan.path)).text,plan.text);
  assert.equal(store.state().docs.find(d=>d.path===file).dirty,true);
 }finally{child?.destroy();store.discard(file);await service.stop();}
});
test('requests are deduplicated, foreign sessions are ignored, and only one editor owns a live lease',async()=>{
 let flushes=0;const service=new LiveDebug(project,store,{flush:async()=>{flushes++;}}),other=new LiveDebug(project,store);
 try{
  await service.start();await assert.rejects(()=>other.start(),/已有/);
  await fs.writeFile(path.join(service.directory,'ffffffff-ffff-ffff-ffff-ffffffffffff.request.json'),JSON.stringify({SchemaVersion:1,Session:'foreign',RequestId:'ffffffff-ffff-ffff-ffff-ffffffffffff',Status:'Requested'}));
  const id=service.session+'-123456-2',first=await request(service,id);assert.equal(first.Status,'Saved');
  await request(service,id);await service.scan();assert.equal(flushes,1);
  assert.equal(await fs.stat(path.join(service.directory,'ffffffff-ffff-ffff-ffff-ffffffffffff.result.json')).catch(()=>null),null);
 }finally{await other.stop();await service.stop();}
});
test('renderer flush failure prevents every disk write and never reports a successful reload',async()=>{
 const file='Assets/CameraAssets/ActionCamera/Player/Run/InputAssets/Run_User.input',before=await project.read(file);
 const service=new LiveDebug(project,store,{flush:async()=>{throw Error('invalid pending numeric value');}});
 try{await service.start();const result=await request(service);assert.equal(result.Status,'Failed');assert.match(result.Message,/numeric/);assert.equal((await project.read(file)).text,before.text);}
 finally{await service.stop();}
});
test('concurrent editor startup has a single lease owner and shutdown removes its lease',async()=>{
 const first=new LiveDebug(project,store),second=new LiveDebug(project,store);
 try{
  const results=await Promise.allSettled([first.start(),second.start()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const owner=first.running?first:second,lease=JSON.parse(await fs.readFile(path.join(owner.directory,'session.json'),'utf8'));
  assert.equal(lease.Session,owner.session);await owner.stop();
  assert.equal(await fs.stat(path.join(owner.directory,'session.json')).catch(()=>null),null);
 }finally{await first.stop();await second.stop();}
});
