const fs=require('node:fs/promises'),{constants}=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const logs=['Assets/Documents.wal','Assets/Editor.wal'];
const pending=item=>['prepared','saved','failed'].includes(item.status);
class EditorJournal {
 constructor(project){this.project=project;this.cache=new Map();this.file=path.join(project.storage,'editor-queue',hash(project.root)+'.json');this.state={version:1,sessionId:null,baselines:{},items:[]};this.tail=Promise.resolve();}
 serial(callback){const job=this.tail.then(callback);this.tail=job.catch(()=>{});return job;}
 stage(...args){return this.serial(()=>this.stageBatch(...args));}
 cancel(...args){return this.serial(()=>this.cancelBatch(...args));}
 observe(...args){return this.serial(()=>this.observeBatch(...args));}
 flush(...args){return this.serial(()=>this.flushBatch(...args));}
 finish(...args){return this.serial(()=>this.finishBatch(...args));}
 async load(){
  try{const state=JSON.parse(await fs.readFile(this.file,'utf8'));if(state.version!==1||!Array.isArray(state.items)||!state.baselines)throw Error('Unsupported editor queue state');this.state=state;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{await this.session();}catch(error){this.lastError=error.message;}
  let recovered=false;for(const item of this.state.items)if(item.status==='prepared'){const disk=await this.project.read(item.path).catch(()=>null);item.status=disk?.text===item.after?'saved':'discarded';recovered=true;}
  if(recovered)await this.persist();return this;
 }
 async persist(){
  const latest=new Map();for(const item of this.state.items)if(['applied','discarded'].includes(item.status))latest.set(item.path,item);
  this.state.items=this.state.items.filter(item=>!['applied','discarded'].includes(item.status)||latest.get(item.path)===item);
  await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(this.state),{encoding:'utf8',flag:'wx'});await fs.rename(temp,this.file);}finally{await fs.unlink(temp).catch(()=>{});}
 }
 async log(relative){
  const full=await this.project.resolve(relative,true);
  try{const stat=await fs.stat(full,{bigint:true}),stamp=[stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(':');const cached=this.cache.get(relative);if(cached?.stamp===stamp)return cached;
   const bytes=await fs.readFile(full),text=bytes.toString('utf8');const result={full,text,bytes,stamp,size:bytes.length,ino:String(stat.ino)};this.cache.set(relative,result);return result;
  }catch(error){if(error.code==='ENOENT'){this.cache.delete(relative);return null;}throw error;}
 }
 async session(){
  const editor=await this.log(logs[1]);if(!editor)return {editor:null};
  let header;try{header=JSON.parse(editor.text.slice(0,editor.text.indexOf('\n')).replace(/^\uFEFF/,''));}catch{throw Error('Editor.wal 文件头无效');}
  if(header.Format!=='DatabaseSystem.EditorWAL'||header.SchemaVersion!==1||header.IndexPath!=='Documents.index.json'||typeof header.SessionId!=='string'||!header.SessionId)throw Error('Editor.wal 会话无效');
  if(this.state.sessionId!==header.SessionId){
   this.state={version:1,sessionId:header.SessionId,indexRevision:this.project.current.indexRevision,baselines:{},items:[]};await this.persist();
  }
  return {editor,header};
 }
 async stageBatch(writes,before,snapshot){
  let session,error;try{session=await this.session();}catch(reason){error=reason.message;}
  if(!session?.editor&&!error)return {ids:[],paths:writes.map(d=>d.path),offline:true};
  const ids=[];
  for(const write of writes){const asset=snapshot.assets.find(a=>a.path===write.path);if(!asset)continue;
   const original=before.find(([file])=>file===write.path)[1];const requestId=crypto.randomUUID();
   this.state.baselines[asset.documentId]??=original;
   this.state.items.push({requestId,documentId:asset.documentId,path:write.path,before:original,after:write.text,status:'prepared',sessionId:this.state.sessionId,error});ids.push(requestId);
  }
  if(ids.length)try{await this.persist();}catch(error){this.state.items=this.state.items.filter(item=>!ids.includes(item.requestId));throw error;}
  return {ids,paths:writes.map(d=>d.path)};
 }
 async cancelBatch(batch){const ids=new Set(batch.ids);this.state.items=this.state.items.filter(item=>!ids.has(item.requestId));if(ids.size)await this.persist();}
 async committed(batch){for(const item of this.state.items)if(batch.ids.includes(item.requestId))item.status='saved';if(batch.ids.length)await this.persist();}
 context(){return {modules:this.project.effectCatalogProvider.bundle.modules,moduleKey:hash(this.project.current.effectCatalog.revision+'[]')};}
 async request(extra={}){
  const {editor}=await this.session(),formal=await this.log(logs[0]);
  if(!editor)throw Error('编辑器会话已结束，JSON 已保存');
  if(!formal)throw Error('Documents.wal 不存在，请先初始化游戏数据库');
  const result=await this.project.validator.journal(this.context(),{indexText:this.project.base.texts.get('Assets/Documents.index.json'),editorText:editor.text,formalText:formal.text,baselines:this.state.baselines,...extra});
  return {result,editor,formal};
 }
 applyReceipt(result){
  if(result.SessionId!==this.state.sessionId)throw Error('编辑器会话已变化，请重试');
  for(const item of this.state.items){
   if(!item.line)continue;
   const accepted=result.Accepted[item.requestId],queued=result.Queued[item.requestId];
   if(accepted||(item.status==='queued'&&!queued)){
    item.status='applied';delete item.error;
    if(item.logicalAfter)this.state.baselines[item.documentId]=item.logicalAfter;
   }else if(queued){item.status='queued';delete item.error;}
  }
 }
 async observeBatch(){
  const previous=JSON.stringify(this.state);
  try{
   await this.session();
   if(this.state.items.some(item=>item.status==='queued'||pending(item))){const {result}=await this.request({observe:true});this.applyReceipt(result);}
   // Recover only JSON writes that actually completed; never reapply a game checkpoint.
   const latest=new Map();for(const item of this.state.items)if(pending(item)&&item.status!=='prepared')latest.set(item.path,item);
   for(const [file,item]of latest){const disk=await this.project.read(file).catch(()=>null);if(!disk||disk.text!==item.after){for(const old of this.state.items)if(old.path===file&&pending(old))old.status='discarded';}}
  }catch(error){for(const item of this.state.items)if(pending(item)){item.status='failed';item.error=error.message;}}
  const changed=previous!==JSON.stringify(this.state);if(changed)await this.persist();return changed;
 }
 async append(editor,formal,text){
  // The host coordinates queue cleanup. Also reject any observed rotation or append.
  this.cache.clear();const [current,wal]=await Promise.all([this.log(logs[1]),this.log(logs[0])]);
  if(!current||!current.bytes.equals(editor.bytes)||!wal||!wal.bytes.equals(formal.bytes))throw Error('日志在追加前发生变化，请重试');
  const handle=await fs.open(current.full,constants.O_RDWR|constants.O_APPEND);
  try{
   const stat=await handle.stat({bigint:true});if(stat.size!==BigInt(current.size)||String(stat.ino)!==current.ino)throw Error('编辑器队列大小或文件身份已变化，请重试');
   const bytes=Buffer.from(text,'utf8');let written=0;
   while(written<bytes.length){const result=await handle.write(bytes,written,bytes.length-written,null);if(!result.bytesWritten)throw Error('编辑器日志追加未完成');written+=result.bytesWritten;}
  }finally{await handle.close();}
  this.cache.delete(logs[1]);const after=await this.log(logs[1]);
  if(!after?.bytes.equals(Buffer.concat([editor.bytes,Buffer.from(text)])))throw Error('日志追加结果未确认，请保留原请求重试');
 }
 async healTail(){
  const {editor}=await this.session();if(!editor||editor.bytes.at(-1)===10)return;
  const tail=editor.bytes.subarray(editor.bytes.lastIndexOf(10)+1);
  const matches=this.state.items.filter(item=>pending(item)&&item.sessionId===this.state.sessionId&&item.line&&tail.length<Buffer.byteLength(item.line)&&Buffer.from(item.line).subarray(0,tail.length).equals(tail));
  if(matches.length!==1)throw Error('队列存在其他写入者的未完成命令，请稍后重试');
  const formal=await this.log(logs[0]);if(!formal)throw Error('Documents.wal 不存在');
  await this.append(editor,formal,Buffer.from(matches[0].line).subarray(tail.length));
 }
 async flushBatch(paths){
  const selected=paths&&new Set(paths);
  try{
   await this.healTail();await this.observeBatch();
   let items=this.state.items.filter(item=>pending(item)&&(!selected||selected.has(item.path)));
   if(!items.length)return this.summary(paths);
   // After accepted commands have been checkpointed, physical JSON is the new
   // baseline. Keep the older baseline only while this document is still queued.
   const first=new Map();for(const item of items)if(!first.has(item.documentId))first.set(item.documentId,item);
   for(const [identity,item]of first)if(!this.state.items.some(old=>old.documentId===identity&&old.status==='queued'))this.state.baselines[identity]=item.before;
   if(this.state.indexRevision!==this.project.current.indexRevision)throw Error('文档索引已变化，请重新进入游戏后同步');
   const {result,editor,formal}=await this.request({items:items.map(({status,error,...item})=>item)});this.applyReceipt(result);
   Object.assign(this.state.baselines,result.Baselines);
   const commands=new Map(result.Commands.map(command=>[command.RequestId,command]));let text='';
   for(const item of items){const command=commands.get(item.requestId);if(!command)continue;item.line=command.Line;item.logicalAfter=command.LogicalAfter||item.logicalAfter;item.status=command.Status==='Applied'?'applied':command.Status==='Queued'?'queued':'saved';delete item.error;if(command.Status==='Prepared')text+=command.Line;}
   // Keep exact bytes and request IDs before attempting IO, including uncertain writes.
   await this.persist();
   if(text){await this.append(editor,formal,text);for(const item of items)if(commands.get(item.requestId)?.Status==='Prepared')item.status='queued';await this.persist();}
  }catch(error){for(const item of this.state.items)if(pending(item)&&(!selected||selected.has(item.path))){item.status='failed';item.error=error.message;}await this.persist().catch(()=>{});}
  return this.summary(paths);
 }
 async finishBatch(batch){
  try{await this.committed(batch);return await this.flushBatch(batch.paths);}catch(error){for(const item of this.state.items)if(batch.ids.includes(item.requestId)){item.status='failed';item.error=error.message;}await this.persist().catch(()=>{});return this.summary(batch.paths);}
 }
 status(file){
  const items=this.state.items.filter(item=>item.path===file&&!['discarded'].includes(item.status));const last=items.at(-1);
  if(!last)return {status:'offline',canRetry:false};
  const failed=items.find(item=>pending(item));
  return {status:failed?'failed':last.status,canRetry:!!failed,error:failed?.error,requestId:last.requestId};
 }
 summary(paths){const selected=paths&&new Set(paths),items=this.state.items.filter(item=>!selected||selected.has(item.path));return {queued:items.filter(item=>item.status==='queued').length,failed:items.filter(pending).length,applied:items.filter(item=>item.status==='applied').length};}
}
module.exports={EditorJournal};
