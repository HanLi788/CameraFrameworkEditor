const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./framework-fixture.cjs'),{Project,encode}=require('../electron/project.cjs'),{Documents}=require('../electron/documents.cjs');
let p,host;
const base='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/',blend=base+'InputBlendAssets/Dash_Default.inputBlend',rig=base+'Dash.rig',value=base+'ValueAssets/Focus/Character/Dash_Player.transitionValue';
const {startGame:game}=require('./game-host.cjs');
before(async()=>{p=await fixture();host=game(p);await host.ready;assert.deepEqual((await p.warmup()).issues,[]);});
after(()=>{host?.close();p?.close();});
async function edit(file,mutate){const doc=await p.read(file),data=JSON.parse(doc.text);mutate(data);return p.save({...doc,text:encode(data)});}
async function queue(){return host.request('queue');}
async function reload(){const r=await host.request('reload');assert.ok(['Imported','NoChange'].includes(r.Status));await p.editorJournal.observe();return r;}
async function field(file,pointer){const a=(await p.getSnapshot()).assets.find(a=>a.path===file);return (await host.request('query',{documentId:a.documentId,pointer})).Value;}
async function docStore(file,mutate){const store=new Documents(p),doc=await store.ensure(file),data=JSON.parse(doc.text);mutate(data);store.editText({path:file,baseText:doc.text,text:encode(data)});return {store,doc,save:()=>store.save({paths:[file],versions:{[file]:doc.version}})};}

test('JSON is saved and actual Lua game stays unchanged until queue import',async()=>{
 const before=await field(blend,'/Rows/0/Weights/FOV');await edit(blend,d=>d.Rows[0].Weights.FOV=2);
 assert.equal(JSON.parse((await p.read(blend)).text).Rows[0].Weights.FOV,2);assert.equal(await field(blend,'/Rows/0/Weights/FOV'),before);
 assert.equal((await queue()).Count,1);assert.equal((await reload()).Accepted,1);assert.equal(await field(blend,'/Rows/0/Weights/FOV'),2);assert.equal(p.editorJournal.status(blend).status,'applied');
});
test('consecutive saves before Ctrl R chain checksums and import only once',async()=>{
 await edit(blend,d=>d.Rows[0].Weights.FOV=3);await edit(blend,d=>d.Rows[0].Weights.FOV=4);
 const q=await queue();assert.equal(q.Count,2);assert.equal(new Set(q.Ids).size,2);assert.equal((await reload()).Accepted,2);assert.equal(await field(blend,'/Rows/0/Weights/FOV'),4);assert.equal((await reload()).Status,'NoChange');
});
test('failed journal append retains saved JSON and clean document Save retries original request',async()=>{
 const {store,doc,save}=await docStore(rig,d=>d.Description='UTF-8 \u4e2d\u6587\nretry');const append=p.editorJournal.append;
 try{p.editorJournal.append=async()=>{throw Error('injected append failure');};const result=await save();assert.equal(result.saved,1);assert.equal(result.sync.failed,1);assert.equal(store.isDirty(doc),false);assert.match(p.editorJournal.status(rig).error,/injected/);const requestId=p.editorJournal.status(rig).requestId;
  p.editorJournal.append=append;const retry=await save();assert.equal(retry.saved,0);assert.equal(retry.sync.failed,0);assert.deepEqual((await queue()).Ids,[requestId]);await reload();assert.equal(await field(rig,'/Description'),'UTF-8 \u4e2d\u6587\nretry');
 }finally{p.editorJournal.append=append;store.close();}
});
test('an unconfirmed successful append is recognized without duplicate commands',async()=>{
 const {store,save}=await docStore(rig,d=>d.Description='uncertain receipt'),append=p.editorJournal.append;let calls=0;
 try{p.editorJournal.append=async function(...args){calls++;await append.apply(this,args);throw Error('lost receipt');};assert.equal((await save()).sync.failed,1);const requestId=p.editorJournal.status(rig).requestId;p.editorJournal.append=append;await save();assert.equal(calls,1);assert.deepEqual((await queue()).Ids,[requestId]);assert.equal((await reload()).Accepted,1);}
 finally{p.editorJournal.append=append;store.close();}
});
test('an owned partial UTF-8 command is completed byte for byte on retry',async()=>{
 const {store,save}=await docStore(rig,d=>d.Description='partial \u4e2d\u6587'),append=p.editorJournal.append;
 try{p.editorJournal.append=async function(editor,formal,text){const bytes=Buffer.from(text),cut=bytes.indexOf(Buffer.from('\u4e2d'))+1;assert.ok(cut>1);await fs.appendFile(editor.full,bytes.subarray(0,cut));this.cache.clear();throw Error('partial append');};assert.equal((await save()).sync.failed,1);p.editorJournal.append=append;await save();assert.equal((await queue()).Count,1);await reload();assert.equal(await field(rig,'/Description'),'partial \u4e2d\u6587');}
 finally{p.editorJournal.append=append;store.close();}
});
test('saved queue and baseline survive restarting the editor',async()=>{
 await edit(blend,d=>d.Rows[0].Weights.FOV=5);const storage=p.storage,root=p.root,runtime=p.runtime;p.close();p=await Project.open(root,storage,runtime);
 await edit(blend,d=>d.Rows[0].Weights.FOV=6);assert.equal((await queue()).Count,2);assert.equal((await reload()).Accepted,2);assert.equal(await field(blend,'/Rows/0/Weights/FOV'),6);
});
test('formal WAL is the checksum baseline and unrelated game changes are preserved',async()=>{
 const asset=(await p.getSnapshot()).assets.find(a=>a.path===value);assert.ok(asset);
 assert.equal((await host.request('submit',{documentId:asset.documentId,patch:[{op:'replace',path:'/Duration',value:.7}]})).Status,'Committed');
 await edit(value,d=>d.Channels.Distance.Value=600);assert.equal(p.editorJournal.status(value).status,'queued');await reload();assert.equal(await field(value,'/Duration'),.7);assert.equal(await field(value,'/Channels/Distance/Value'),600);
});
test('a checkpoint establishes a fresh logical baseline within the same session',async()=>{
 const asset=(await p.getSnapshot()).assets.find(a=>a.path===value);
 await host.request('submit',{documentId:asset.documentId,patch:[{op:'replace',path:'/Duration',value:1.2}]});assert.equal((await host.request('checkpoint')).Status,'Checkpointed');
 await p.editorJournal.observe();await p.snapshot();await edit(value,d=>d.Channels.Distance.Value=610);await reload();assert.equal(await field(value,'/Duration'),1.2);assert.equal(await field(value,'/Channels/Distance/Value'),610);
});
test('observed concurrent append leaves both producers intact and retries safely',async()=>{
 const {store,save}=await docStore(rig,d=>d.Description='coordinated writer'),append=p.editorJournal.append,asset=(await p.getSnapshot()).assets.find(a=>a.path===blend);
 try{let first=true;p.editorJournal.append=async function(...args){if(first){first=false;await host.request('queue',{documentId:asset.documentId,requestId:'other-editor',patch:[{op:'replace',path:'/Rows/0/Weights/FOV',value:7}]});}return append.apply(this,args);};assert.equal((await save()).sync.failed,1);p.editorJournal.append=append;await save();assert.equal((await queue()).Count,2);await reload();assert.equal(await field(blend,'/Rows/0/Weights/FOV'),7);assert.equal(await field(rig,'/Description'),'coordinated writer');}
 finally{p.editorJournal.append=append;store.close();}
});
test('an append arriving after the size check is never overwritten',async()=>{
 const {store,save}=await docStore(rig,d=>d.Description='append race'),open=fs.open,asset=(await p.getSnapshot()).assets.find(a=>a.path===blend);let injected=false;
 try{fs.open=async function(file,flags,...args){const handle=await open.call(this,file,flags,...args);if(!String(file).endsWith('Editor.wal')||typeof flags!=='number')return handle;return new Proxy(handle,{get(target,key){if(key==='stat')return async(...args)=>{const stat=await target.stat(...args);if(!injected){injected=true;await host.request('queue',{documentId:asset.documentId,requestId:'append-after-stat',patch:[{op:'replace',path:'/Rows/0/Weights/FOV',value:8}]});}return stat;};const value=target[key];return typeof value==='function'?value.bind(target):value;}});};
  assert.equal((await save()).sync.failed,1);fs.open=open;assert.equal((await queue()).Count,2);await save();assert.equal((await queue()).Count,2);await reload();assert.equal(await field(blend,'/Rows/0/Weights/FOV'),8);assert.equal(await field(rig,'/Description'),'append race');
 }finally{fs.open=open;store.close();}
});
test('game lifecycle changes discard old session requests and keep checkpoint authority',async()=>{
 await edit(value,d=>d.Channels.Distance.Value=700);const old=(await queue()).SessionId;assert.equal((await host.request('reset')).Status,'Ready');assert.notEqual((await queue()).SessionId,old);await p.editorJournal.observe();assert.equal(p.editorJournal.status(value).canRetry,false);assert.equal((await queue()).Count,0);
 assert.equal(JSON.parse((await p.read(value)).text).Channels.Distance.Value,610);await p.snapshot();await edit(value,d=>d.Channels.Distance.Value=650);await reload();assert.equal(await field(value,'/Channels/Distance/Value'),650);
});
test('failed JSON save-all rolls back without appending editor commands',async()=>{
 const a=await p.read(rig),b=await p.read(blend),oldQueue=await fs.readFile(path.join(p.root,'Assets/Editor.wal'),'utf8'),atomic=p.atomic;let writes=0;
 try{p.atomic=async function(...args){if(++writes===2)throw Error('injected JSON failure');return atomic.apply(this,args);};await assert.rejects(()=>p.saveMany([a,b].map(d=>({...d,text:encode({...JSON.parse(d.text),Description:'rollback'})}))),/injected/);assert.equal((await p.read(rig)).text,a.text);assert.equal((await p.read(blend)).text,b.text);assert.equal(await fs.readFile(path.join(p.root,'Assets/Editor.wal'),'utf8'),oldQueue);}
 finally{p.atomic=atomic;}
});
test('outbox preparation failure leaves JSON unchanged and does not poison the next save',async()=>{
 const doc=await p.read(rig),persist=p.editorJournal.persist;
 try{let first=true;p.editorJournal.persist=async function(){if(first){first=false;throw Error('outbox preparation failure');}return persist.call(this);};await assert.rejects(()=>edit(rig,d=>d.Description='retry preparation'),/outbox preparation/);assert.equal((await p.read(rig)).text,doc.text);}
 finally{p.editorJournal.persist=persist;}
 await edit(rig,d=>d.Description='retry preparation');assert.equal((await queue()).Count,1);await reload();assert.equal(await field(rig,'/Description'),'retry preparation');
});
test('malformed queue preserves JSON and can be retried after the queue is repaired',async()=>{
 const file=path.join(p.root,'Assets/Editor.wal'),header=await fs.readFile(file,'utf8');await fs.appendFile(file,'invalid record\n');const {store,save}=await docStore(rig,d=>d.Description='queue repair');
 try{assert.equal((await save()).sync.failed,1);assert.equal(JSON.parse((await p.read(rig)).text).Description,'queue repair');await fs.writeFile(file,header);await save();assert.equal((await queue()).Count,1);await reload();assert.equal(await field(rig,'/Description'),'queue repair');}finally{store.close();}
});
test('offline JSON saves do not create a game-owned Editor.wal session',async()=>{
 const offline=await fixture();try{const file=path.join(offline.root,'Assets/Editor.wal');await fs.unlink(file);const original=await offline.read(rig);await offline.save({...original,text:encode({...JSON.parse(original.text),Description:'offline'})});assert.equal(JSON.parse((await offline.read(rig)).text).Description,'offline');await assert.rejects(()=>fs.stat(file),/ENOENT/);assert.equal(offline.editorJournal.status(rig).status,'offline');}finally{offline.close();}
});
