// UE captures Ctrl+S in its existing input context. Saving and reloading use an
// acknowledged workspace protocol, so neither application needs to steal focus.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const watch=require('node:fs').watch;
const {PLAN}=require('./postprocessing.cjs');
const idPattern=/^[a-f0-9-]{20,120}$/;
async function read(file){try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)return null;return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}}
async function atomic(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(value)+'\n',{flag:'wx'});await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}}
class LiveDebug {
  constructor(project,documents,{flush=async()=>{},notify=()=>{}}={}){
    this.project=project;this.documents=documents;this.flush=flush;this.notify=notify;
    this.session=crypto.randomUUID();this.pending=new Map();this.status='offline';this.queue=Promise.resolve();
  }
  state(){return {status:this.status,message:this.message||'',busy:!!this.busy};}
  emit(status,message=''){this.status=status;this.message=message;this.notify(this.state());}
  async start(){
    this.directory=await this.project.resolve('.editor/live-debug',true);
    await fs.mkdir(this.directory,{recursive:true});await this.project.resolve('.editor/live-debug');
    const sessionFile=path.join(this.directory,'session.json');
    const lease=await read(sessionFile);
    if(lease?.ExpiresAt>Math.floor(Date.now()/1000))throw Error('此工作区已有相机编辑器连接 UE 调试');
    const stat=await fs.stat(sessionFile).catch(()=>null);
    if(stat){
      if(!lease&&Date.now()-stat.mtimeMs<8000)throw Error('另一个相机编辑器正在建立 UE 调试连接');
      await fs.unlink(sessionFile).catch(e=>{if(e.code!=='ENOENT')throw e;});
    }
    await fs.writeFile(sessionFile,JSON.stringify({SchemaVersion:1,Session:this.session,ExpiresAt:Math.floor(Date.now()/1000)+8}),{flag:'wx'});
    this.running=true;
    await this.heartbeat();
    this.watcher=watch(this.directory,()=>this.scan().catch(e=>this.emit('error',e.message)));
    this.watcher.on('error',e=>this.emit('error',e.message));
    this.timer=setInterval(()=>this.heartbeat().then(()=>this.scan()).catch(e=>this.emit('error',e.message)),2000);
    this.timer.unref?.();this.emit('ready');return this.state();
  }
  async heartbeat(){
    if(!this.running)return;
    const file=path.join(this.directory,'session.json');
    if((await read(file))?.Session!==this.session){this.running=false;clearInterval(this.timer);this.watcher?.close();throw Error('UE 调试连接已由其他编辑器接管');}
    await atomic(file,{SchemaVersion:1,Session:this.session,ExpiresAt:Math.floor(Date.now()/1000)+8});
  }
  async scan(){
    if(!this.running||this.scanning)return;this.scanning=true;
    try{
      for(const file of await fs.readdir(this.directory)){
        const match=/^([a-f0-9-]+)\.request\.json$/.exec(file);
        if(!match||!idPattern.test(match[1])||this.pending.has(match[1]))continue;
        const request=await read(path.join(this.directory,file));
        if(!request||request.SchemaVersion!==1||request.Session!==this.session||request.RequestId!==match[1]||request.Status!=='Requested')continue;
        this.pending.set(request.RequestId,{at:Date.now()});
        this.queue=this.queue.then(()=>this.save(request)).catch(e=>this.emit('error',e.message));
      }
      for(const [id,entry]of this.pending){
        if(!entry.done)continue;
        const ack=await read(path.join(this.directory,id+'.ack.json'));
        if(ack?.SchemaVersion===1&&ack.Session===this.session&&ack.RequestId===id&&['Reloaded','Failed'].includes(ack.Status)){
          this.emit(ack.Status==='Reloaded'?'reloaded':'error',ack.Status==='Reloaded'?'':'UE 未完成相机重装，请查看 Lua 日志');
          await this.remove(id);
        }else if(Date.now()-entry.at>60000){this.emit('error','等待 UE 相机重装确认超时');await this.remove(id);}
      }
    }finally{this.scanning=false;}
  }
  async save(request){
    if(!this.running)return;
    this.busy=true;this.emit('saving');
    let status='Saved',message='';
    try{
      await this.flush();
      if(!this.running)return;
      const docs=this.documents.state().docs.filter(d=>d.dirty);
      await this.documents.save({paths:docs.map(d=>d.path),versions:Object.fromEntries(docs.map(d=>[d.path,d.version]))});
      // Also validate disk-only edits and refresh the generated plan when there
      // were no asset drafts. Reloading must never consume an obsolete plan.
      await this.project.serial(async()=>{
        const snapshot=await this.project.snapshot();const result=await this.project.validate();
        if(!result.runtime||result.issues.some(i=>i.severity==='error'))throw Error(result.issues.filter(i=>i.severity==='error').map(i=>i.path+' '+i.message).join('\n')||'Lua 校验未完成');
        if(typeof result.planText!=='string')throw Error('Lua 未生成后处理执行计划');
        await this.project.assertUnchanged(snapshot);
        const before=await this.project.read(PLAN).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
        if(before?.text!==result.planText){await this.project.backup([[PLAN,before?.text??null]],'live-debug');await this.project.atomic(PLAN,result.planText);}
      });
    }catch(e){status='Failed';message=e.message;}
    finally{this.busy=false;}
    if(!this.running)return;
    const pending=this.pending.get(request.RequestId);if(pending){pending.done=true;pending.at=Date.now();}
    await atomic(path.join(this.directory,request.RequestId+'.result.json'),{SchemaVersion:1,Session:this.session,RequestId:request.RequestId,Status:status,Message:message});
    this.emit(status==='Saved'?'waiting':'error',message);
  }
  async remove(id){this.pending.delete(id);for(const suffix of ['request','result','ack'])await fs.unlink(path.join(this.directory,id+'.'+suffix+'.json')).catch(()=>{});}
  async stop(){
    this.running=false;clearInterval(this.timer);this.watcher?.close();
    if(this.directory){const file=path.join(this.directory,'session.json');if((await read(file))?.Session===this.session)await fs.unlink(file).catch(()=>{});}
    await this.queue;
    for(const id of this.pending.keys())await this.remove(id);
  }
}
module.exports={LiveDebug};
