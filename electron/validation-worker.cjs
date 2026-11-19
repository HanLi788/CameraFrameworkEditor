const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
class ValidationWorker {
 constructor(runtime){this.runtime=runtime;this.sequence=0;this.pending=new Map();this.tail=Promise.resolve();this.sources=new Map();this.stats={starts:0,requests:0,validationRequests:0,journalRequests:0,bytes:0};}
 async start(modules,key){
  if(this.child&&this.key===key)return;
  this.close();this.key=key;
  const script=await fs.readFile(path.join(__dirname,'validator-worker.lua'),'utf8');
  const child=spawn(this.runtime||'lua54',['-e','do\n'+script+'\nend'],{windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;this.stats.starts++;
  child.unref();for(const stream of [child.stdin,child.stdout,child.stderr])stream.unref?.();
  let output='',errors='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{output+=chunk;let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end);output=output.slice(end+1);if(!line.startsWith('EDITOR_RESULT:'))continue;try{const result=JSON.parse(line.slice(14)),job=this.pending.get(result.id);if(job){this.pending.delete(result.id);clearTimeout(job.timer);job.resolve(result);}}catch(error){this.fail(error);}}});
  child.stderr.on('data',chunk=>errors+=chunk);child.stdin.on('error',()=>{});
  child.on('error',error=>{if(this.child===child)this.fail(error);});child.on('close',code=>{if(this.child!==child)return;this.child=undefined;this.fail(Error(errors||'Lua validation worker exited: '+code));});
  await this.request({modules,journalScript:await fs.readFile(path.join(__dirname,'editor-journal.lua'),'utf8')});
 }
 fail(error){for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(error);}this.pending.clear();}
 request(payload){
  const id=++this.sequence,wire=JSON.stringify({...payload,id})+'\n';this.stats.requests++;this.stats.bytes+=Buffer.byteLength(wire);
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.fail(Error('Lua validation timed out (15 seconds)'));this.child?.kill();},15000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(wire,error=>{if(error)this.fail(error);});});
 }
 check({modules,moduleKey,snapshot,texts,full=false}){
  const task=this.tail.catch(()=>{}).then(async()=>{
   await this.start(modules,moduleKey);
   const next=new Map(snapshot.assets.map(asset=>[asset.documentId,{path:asset.path,type:asset.type,documentId:asset.documentId,text:texts.get(asset.path),revision:asset.revision,refs:asset.refs}]));
   const index=JSON.stringify(snapshot.documentIndex),structural=this.index!==index||next.size!==this.sources.size;
   const changes={},changed=new Set();
   for(const [id,asset]of next)if(this.sources.get(id)?.text!==asset.text||this.sources.get(id)?.path!==asset.path){changes[id]={text:asset.text,revision:asset.revision};changed.add(id);}
   for(const id of this.sources.keys())if(!next.has(id))changed.add(id);
   const reverse=new Map();for(const assets of [this.sources,next])for(const asset of assets.values())for(const ref of asset.refs||[]){if(!reverse.has(ref.documentId))reverse.set(ref.documentId,new Set());reverse.get(ref.documentId).add(asset.documentId);}
   const affected=new Set(changed),queue=[...changed];while(queue.length)for(const id of reverse.get(queue.pop())||[])if(!affected.has(id)){affected.add(id);queue.push(id);}
   this.stats.validationRequests++;const result=await this.request({changes,affected:[...affected],revision:snapshot.snapshotRevision,full,...(structural?{assets:[...next.values()].map(({path,type,documentId})=>({path,type,documentId})),index}:{} )});
   this.sources=next;this.index=index;
   const dependencies=new Set([...(result.dependencies||[]),...affected]),forward=[...dependencies];
   while(forward.length)for(const ref of next.get(forward.pop())?.refs||[])if(!dependencies.has(ref.documentId)){dependencies.add(ref.documentId);forward.push(ref.documentId);}
   return {...result,dependencyPaths:[...dependencies].map(id=>next.get(id)?.path).filter(Boolean)};
  });this.tail=task;return task;
 }
 journal({modules,moduleKey},payload){
  const task=this.tail.catch(()=>{}).then(async()=>{await this.start(modules,moduleKey);this.stats.journalRequests++;const result=await this.request({operation:'journal',...payload});if(result.error)throw Error(result.error);return result;});this.tail=task;return task;
 }
 close(){this.fail(Error('Lua validation worker closed'));this.child?.kill();this.child=undefined;this.sources=new Map();this.index=undefined;}
}
module.exports={ValidationWorker,digest};
