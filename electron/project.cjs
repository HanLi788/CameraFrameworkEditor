const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {InputCatalog,inputIssues}=require('./input-catalog.cjs');
const {EffectCatalog}=require('./effect-catalog.cjs');
const {generated,writable}=require('./postprocessing.cjs');
const {ValidationWorker}=require('./validation-worker.cjs');
const {buildView}=require('./project-view.cjs');
const {EditorJournal}=require('./editor-journal.cjs');
const {extensions,typeOf,assetKey,references,indexPath}=require('./asset-protocol.cjs');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const json = text => JSON.parse(text.replace(/^\uFEFF/, ''));
const encode = data => JSON.stringify(data, null, 2) + '\n';
const slash = p => p.split(path.sep).join('/');
const temporary = p => p.endsWith('.tmp')||/-database-tmp-\d+-\d+(?:\.[^/]+)?$/.test(p);
const isInside = (root,p) => p === root || (!path.relative(root,p).startsWith('..'+path.sep) && path.relative(root,p) !== '..' && !path.isAbsolute(path.relative(root,p)));
function cleanRelative(p) {
  if (typeof p !== 'string' || !p || /[\\:\x00-\x1f<>"|?*]/.test(p) || p.split('/').some(x => !x || x==='.' || x==='..' || /[. ]$/.test(x) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(x))) throw Error('路径必须是框架内的有效相对路径');
  return p;
}
class Project {
  constructor(root, storage, runtime) {this.root=root; this.workspaceRoot=path.dirname(root); this.storage=storage; this.runtime=runtime; this.inputCatalogProvider=new InputCatalog(); this.effectCatalogProvider=new EffectCatalog(); this.queue=Promise.resolve();this.validator=new ValidationWorker(runtime);this.stamps=new Map();this.pendingChanges=new Set();this.proofs=new Map();this.epoch=0;this.editorJournal=new EditorJournal(this);}
  static async open(root,storage,runtime) {
    root = await fs.realpath(root);
    const isFramework=async dir=>Boolean(await fs.stat(path.join(dir,'Editor','Workspace.lua')).catch(()=>null));
    if(!await isFramework(root))root=await fs.realpath(path.join(root,'CameraFramework')).catch(()=>{throw Error('请选择包含 CameraFramework、InputSystem、Foundation 的 Lua 工作区目录');});
    if(!await isFramework(root))throw Error('所选目录不支持当前路径资产协议，请先更新 Lua 相机框架');
    const p = new Project(root,storage,runtime);
    for(const required of ['InputSystem/InputManager.lua','InputSystem/MyIMC/Definition/Definitions','Foundation/Math/Vector3D.lua','DatabaseSystem/Database.lua','CameraFramework/Assets/Documents.index.json']){
      if(!await fs.stat(path.join(p.workspaceRoot,required)).catch(()=>null))throw Error('Lua 工作区缺少依赖：'+required);
    }
    await p.snapshot();await p.editorJournal.load();return p;
  }
  async resolve(relative, creating=false) {
    cleanRelative(relative);
    const full=path.resolve(this.root,relative);
    if(!isInside(this.root,full)) throw Error('路径超出框架目录');
    let check=full;
    while(true) {
      try { const real=await fs.realpath(check); if(!isInside(this.root,real)) throw Error('链接目标超出框架目录'); break; }
      catch(e) {if(e.code!=='ENOENT'||!creating)throw e; const parent=path.dirname(check);if(parent===check)throw e;check=parent;}
    }
    return full;
  }
  async read(relative) {
    const full=await this.resolve(relative); const stat=await fs.stat(full,{bigint:true});
    if(!stat.isFile()||stat.size>8n*1024n*1024n) throw Error('仅支持 8 MB 以内的文本文件');
    const bytes=await fs.readFile(full); if(bytes.includes(0)) throw Error('此文件为二进制文件，不能作为文本打开');
    let text; try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw Error('文件不是有效的 UTF-8 文本');}
    // A receipt read must not attach a new disk stamp to stale cached content.
    if(!this.base||this.base.texts.get(relative)===text)this.stamps.set(relative,[stat.size,stat.mtimeNs??BigInt(Math.round(stat.mtimeMs*1e6)),stat.ctimeNs??BigInt(Math.round(stat.ctimeMs*1e6)),stat.ino].join(':'));
    return {path:relative,text,revision:hash(text),readOnly:generated(relative)};
  }
  compose(overrides={},base=this.base){return buildView(base,overrides,{hash,json,cleanRelative});}
  install(base,snapshot){
    const changed=this.current?.snapshotRevision!==snapshot.snapshotRevision;
    this.base=base;this.current=snapshot;
    this.environment=new Map([...(this.inputCatalogProvider.bundle?.stamps||[]),...(this.effectCatalogProvider.bundle?.stamps||[])]);
    if(changed){this.epoch++;this.proofs.clear();}
    return snapshot;
  }
  async snapshot(overrides={}) {
    const files=[],directories=[''];
    const walk=async(dir='')=>{for(const entry of await fs.readdir(path.join(this.root,dir),{withFileTypes:true})){
      if(entry.isSymbolicLink()||['.git','node_modules','.editor'].includes(entry.name)||temporary(entry.name))continue;
      const relative=dir?dir+'/'+entry.name:entry.name;
      if(entry.isDirectory()){directories.push(relative);await walk(relative);}else if(entry.isFile())files.push({path:relative,name:entry.name,dir,extension:path.extname(entry.name).toLowerCase()});
    }};
    await walk();
    const texts=new Map();
    await Promise.all(files.filter(file=>file.path===indexPath||Object.values(extensions).some(extension=>extension.toLowerCase()===file.extension)).map(async file=>{try{texts.set(file.path,(await this.read(file.path)).text);}catch(error){texts.set(file.path,undefined);}}));
    const [inputCatalog,effectCatalog]=await Promise.all([this.inputCatalogProvider.read(this.workspaceRoot,this.runtime),this.effectCatalogProvider.read(this.workspaceRoot,this.runtime)]);
    const base={root:this.root,workspaceRoot:this.workspaceRoot,files,directories,texts,inputCatalog,effectCatalog};
    this.install(base,this.compose({},base));
    if(!Object.keys(overrides).length)return this.current;
    const candidateBase=Object.keys(overrides).some(file=>file.endsWith('.lua'))?{...base,effectCatalog:await this.effectCatalogProvider.read(this.workspaceRoot,this.runtime,overrides)}:base;
    return this.compose(overrides,candidateBase);
  }
  async getSnapshot(){if(!this.current)return this.snapshot();return this.current;}
  noteChange(relative,domain='CameraFramework'){
    if(!relative){this.fullRefresh=true;return;}
    relative=String(relative).replaceAll('\\','/');
    if(temporary(relative)||relative.startsWith('.editor/'))return;
    if(relative==='Assets/Editor.wal'||relative==='Assets/Documents.wal'){this.journalChanged=true;return;}
    if(domain!=='CameraFramework'||relative.endsWith('.lua')||relative===indexPath){this.fullRefresh=true;return;}
    if(typeOf(relative))this.pendingChanges.add(relative);
    else if(!path.extname(relative)||this.base?.directories.includes(relative)){this.pendingDirectories??=new Set();this.pendingDirectories.add(relative);}
  }
  flushChanges(){const job=(this.flushQueue||Promise.resolve()).then(async()=>{let journalChanged=false;if(this.journalChanged){this.journalChanged=false;journalChanged=await this.editorJournal.observe();}return {...await this.flushChangeBatch(),journalChanged};});this.flushQueue=job.catch(()=>{});return job;}
  async flushChangeBatch(){
    // Windows reports the parent directory on atomic file replacement as well.
    // Check its immediate children before deciding that the asset tree changed.
    const directories=[...this.pendingDirectories||[]];this.pendingDirectories?.clear();
    for(const directory of directories){
      try{
        const children=await fs.readdir(await this.resolve(directory),{withFileTypes:true});
        const actual=children.filter(item=>!item.isSymbolicLink()&&!temporary(item.name)&&!['.git','node_modules','.editor'].includes(item.name)).map(item=>item.name+(item.isDirectory()?'/':'')).sort();
        const expected=[...this.base.files.filter(file=>file.dir===directory).map(file=>file.name),...this.base.directories.filter(dir=>dir&&path.posix.dirname(dir)===directory).map(dir=>path.posix.basename(dir)+'/')].filter(name=>!temporary(name)).sort();
        if(JSON.stringify(actual)!==JSON.stringify(expected))this.fullRefresh=true;
      }catch{this.fullRefresh=true;}
    }
    if(this.fullRefresh){this.fullRefresh=false;this.pendingChanges.clear();const before=this.current;const snapshot=await this.snapshot();this.externalFull=true;return {snapshot,full:true,changed:before?.assets.map(asset=>asset.path)||[]};}
    const paths=[...this.pendingChanges];this.pendingChanges.clear();const changed=[];
    if(!this.base)return {snapshot:await this.snapshot(),full:true,changed:paths};
    for(const file of paths){
      const asset=this.current.assets.find(asset=>asset.path===file);if(!asset){this.externalFull=true;return {snapshot:await this.snapshot(),full:true,changed:paths};}
      let doc;try{doc=await this.read(file);}catch{this.externalFull=true;return {snapshot:await this.snapshot(),full:true,changed:paths};}
      if(doc.revision!==asset.revision){this.base.texts.set(file,doc.text);changed.push(file);}
    }
    if(changed.length){this.install(this.base,this.compose());this.externalChanges??=new Set();for(const file of changed)this.externalChanges.add(file);}
    return {snapshot:this.current,full:false,changed};
  }
  async environmentChanged(){
    if(this.watchCoverage)return false;
    const stamps=await Promise.all([...this.environment||[]].map(async([file,expected])=>{try{const stat=await fs.stat(file,{bigint:true});return [stat.size,stat.mtimeNs,stat.ctimeNs,stat.ino].join(':')!==expected;}catch{return true;}}));
    return stamps.some(Boolean);
  }
  async synchronize(){
    await this.getSnapshot();
    if(await this.environmentChanged())this.fullRefresh=true;
    return this.flushChanges();
  }
  async checkCandidate(overrides={},full=false){
    if(!full)await this.synchronize();
    const snapshot=full?await this.snapshot(overrides):this.compose(overrides);
    const moduleOverrides=Object.entries(overrides).filter(([file,text])=>file.endsWith('.lua')&&text!==null);
    const key=hash(snapshot.snapshotRevision+JSON.stringify(moduleOverrides));
    if(!full&&this.proofs.has(key))return this.proofs.get(key);
    const epoch=this.epoch,base=this.current,stamps=new Map(this.stamps);
    const job=(async()=>{
      if(snapshot.issues.some(issue=>issue.severity==='error'))return {issues:snapshot.issues,checked:0,runtime:false,key,epoch};
      const modules={...this.effectCatalogProvider.bundle.modules};for(const[file,text]of moduleOverrides)modules['CameraFramework.'+file.slice(0,-4).split('/').join('.')]=text;
      const texts=new Map(this.base.texts);for(const[file,text]of Object.entries(overrides)){if(text===null)texts.delete(file);else texts.set(file,text);}
      const result=await this.validator.check({modules,moduleKey:hash(this.current.effectCatalog.revision+JSON.stringify(moduleOverrides)),snapshot,texts,full});
      const dependencies=[...new Set([indexPath,...result.dependencyPaths])];
      return {...result,key,epoch,issues:[...snapshot.issues,...result.issues],proof:dependencies.map(file=>({path:file,stamp:stamps.get(file),revision:file===indexPath?base.indexRevision:base.assets.find(asset=>asset.path===file)?.revision}))};
    })();
    this.proofs.set(key,job);if(this.proofs.size>16)this.proofs.delete(this.proofs.keys().next().value);
    job.catch(()=>{if(this.proofs.get(key)===job)this.proofs.delete(key);});return job;
  }
  async verifyProof(result,requests){
    if(await this.environmentChanged()){this.fullRefresh=true;throw Error('校验期间输入定义或模块已被外部修改，请刷新后重试');}
    if(this.fullRefresh||result.epoch!==this.epoch)throw Error('校验期间工程依赖发生变化，请重试');
    const targets=new Set(requests.map(doc=>doc.path));
    await Promise.all((result.proof||[]).filter(doc=>!targets.has(doc.path)).map(async doc=>{
      const full=await this.resolve(doc.path),stat=await fs.stat(full,{bigint:true}),stamp=[stat.size,stat.mtimeNs,stat.ctimeNs,stat.ino].join(':');
      if(stamp!==doc.stamp){const actual=await this.read(doc.path);if(actual.revision!==doc.revision){this.noteChange(doc.path);throw Error('校验期间依赖已被外部修改：'+doc.path);}doc.stamp=stamp;}
    }));
  }
  async applyCommitted(files){
    for(const file of files)this.base.texts.set(file.path,file.text);
    return this.install(this.base,this.compose());
  }
  warmup(){return this.checkCandidate({},true);}
  close(){this.validator.close();}
  async assertUnchanged(snapshot) {
    if((await this.snapshot()).snapshotRevision!==snapshot.snapshotRevision)throw Error('校验期间资产文件发生变化，请刷新后重试');
  }
  async validate(overrides={}) {return this.checkCandidate(overrides,true);}
  serial(fn){const result=this.queue.then(fn);this.queue=result.catch(()=>{});return result;}
  async backup(entries, label) {
    const dir=path.join(this.storage,'recovery',Date.now()+'-'+crypto.randomBytes(4).toString('hex'));
    await fs.mkdir(dir,{recursive:true});
    const manifest={root:this.root,label,files:[]};
    for(let i=0;i<entries.length;i++){const [relative,text]=entries[i];manifest.files.push({path:relative,backup:`${i}.txt`,existed:text!==null});if(text!==null)await fs.writeFile(path.join(dir,`${i}.txt`),text,'utf8');}
    await fs.writeFile(path.join(dir,'manifest.json'),encode(manifest));return dir;
  }
  async atomic(relative,text) {
    const full=await this.resolve(relative,true); await fs.mkdir(path.dirname(full),{recursive:true});
    const temp=full+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
    try {await fs.writeFile(temp,text,{encoding:'utf8',flag:'wx'});await fs.rename(temp,full);} finally {await fs.unlink(temp).catch(()=>{});}
  }
  async save(request) {return (await this.saveMany([request]))[0];}
  retryJournal(paths){return this.serial(()=>this.editorJournal.flush(paths));}
  saveMany(requests) {return this.serial(async()=>{
    if(!Array.isArray(requests)||!requests.length||requests.length>200)throw Error('保存请求无效');
    await this.synchronize();
    const snap=await this.getSnapshot(),before=[],overrides={},seen=new Set();let hasAsset=false;
    for(const {path:relative,text,revision} of requests){
      writable(relative);
      if(seen.has(relative.toLowerCase()))throw Error('重复保存路径');seen.add(relative.toLowerCase());
      const doc=await this.read(relative);if(doc.revision!==revision)throw Error('文件已被外部修改。请重新载入或复制草稿后合并；没有覆盖磁盘内容。');
      if(typeof text!=='string'||Buffer.byteLength(text)>8*1024*1024)throw Error('文本过大');
      const asset=snap.assets.find(a=>a.path===relative);
      if(asset||relative===indexPath||relative.endsWith('.lua'))hasAsset=true;
      before.push([relative,doc.text]);overrides[relative]=text;
    }
    let check;
    if(hasAsset){check=await this.checkCandidate(overrides);if(check.issues.some(i=>i.severity==='error'))throw Error(check.issues.filter(i=>i.severity==='error').map(i=>i.path+' '+i.message).join('\n'));}
    for(const d of requests)if((await this.read(d.path)).revision!==d.revision)throw Error('校验期间磁盘文件发生变化，请重新载入');
    if(hasAsset)await this.verifyProof(check,requests);
    const batch=await this.editorJournal.stage(requests,before,snap);let backup;
    try{backup=await this.backup(before,'save');}catch(error){await this.editorJournal.cancel(batch).catch(()=>{});throw error;}
    try{for(const d of requests)await this.atomic(d.path,d.text);}
    catch(e){for(const [rel,text]of before){if(text===null)await fs.unlink(await this.resolve(rel,true)).catch(()=>{});else await this.atomic(rel,text);}await this.editorJournal.cancel(batch).catch(()=>{});throw e;}
    const files=await Promise.all(requests.map(async d=>({...await this.read(d.path),backup})));
    if(requests.some(doc=>doc.path===indexPath||doc.path.endsWith('.lua')))await this.snapshot();else await this.applyCommitted(files);
    await this.editorJournal.finish(batch);
    return files;
  });}
  mutate(request){return this.serial(async()=>{const result=await this.mutateCandidate(request);await this.snapshot();return result;});}
  async mutateCandidate(request){
    const snap=await this.snapshot();
    if(request.sourcePath)writable(request.sourcePath);if(request.path)writable(request.path);
    if(request.snapshotRevision!==snap.snapshotRevision)throw Error('资产文件已变化，请刷新后重试');
    if(request.kind==='create-directory') {
      const relative=cleanRelative(request.path);
      if(!relative.startsWith('Assets/'))throw Error('新文件夹必须位于 Assets 内');
      const parent=await this.resolve(path.posix.dirname(relative));
      if(!(await fs.stat(parent)).isDirectory())throw Error('父目录不存在');
      const destination=await this.resolve(relative,true);
      try {await fs.mkdir(destination);} catch(e) {if(e.code==='EEXIST')throw Error('同名文件或文件夹已存在');throw e;}
      return {directory:relative};
    }
    const entries=[];
    const source=snap.assets.find(a=>a.path===request.sourcePath);
    if(['copy','move','delete'].includes(request.kind)&&!source)return require('./workspace-files.cjs').mutateFiles(this,request,snap,{cleanRelative,extensions,references,encode});
    let destination;
    if(['copy','create-curve','create-asset'].includes(request.kind)) {
      const creating=request.kind==='create-curve',type=creating?'Curve':source?.type||request.type;
      const builtInBoolean=request.kind==='create-asset'&&!source&&type==='BoolEffect';
      if(!creating&&!source?.data&&!builtInBoolean)throw Error('请选择有效模板资产');
      if(request.kind==='create-asset'&&source&&source.type!==request.type)throw Error('模板类型不匹配');
      if(creating&&!['Bezier','CubicHermiteSpline'].includes(request.parentType))throw Error('不支持的曲线父类型');
      destination=cleanRelative(request.path);
      if(path.extname(destination)!==extensions[type])throw Error('新资产必须保留类型后缀');
      if(await fs.stat(await this.resolve(destination,true)).catch(()=>null))throw Error('目标文件已存在');
      const data=creating?{SchemaVersion:1,ParentType:request.parentType,...(request.parentType==='Bezier'?{P1:{X:0,Y:0},P2:{X:1/3,Y:1/3},P3:{X:2/3,Y:2/3},P4:{X:1,Y:1}}:{Points:[{X:0,Y:0,Tangent:0},{X:1,Y:1,Tangent:0}]})}:builtInBoolean?{SchemaVersion:1,Name:'NewEffect',Description:'',Reachability:'Always',BlendIn:{Duration:.2,Curve:'Shared/CurveAssets/Bezier/EaseInOut.curve'},BlendOut:{Duration:.2,Curve:'Shared/CurveAssets/Bezier/EaseInOut.curve'},Outputs:{}}:structuredClone(source.data);
      if(builtInBoolean){const curve=snap.assets.find(a=>a.type==='Curve'&&a.documentId==='Shared/CurveAssets/Bezier/EaseInOut.curve')||snap.assets.find(a=>a.type==='Curve');if(!curve)throw Error('创建布尔效果需要共享曲线');for(const blend of [data.BlendIn,data.BlendOut])blend.Curve=require('./asset-protocol.cjs').documentReference(curve.documentId);}
      if(request.kind==='create-asset'&&type==='Value')data.bEnabled=true;
      if(request.kind==='create-asset'&&Object.hasOwn(data,'Name'))data.Name=path.posix.basename(destination,path.posix.extname(destination));
      entries.push([destination,encode(data)]);
    } else if(request.kind==='move'||request.kind==='delete') {
      if(!source)throw Error('资产不存在');
      const doc=await this.read(source.path);if(request.sourceRevision!==doc.revision)throw Error('源文件已变化，请刷新后重试');
      const users=snap.assets.filter(a=>a.path!==source.path&&a.refs.some(r=>r.path.toLowerCase()===source.path.toLowerCase()));
      if(request.kind==='delete') {
        const dependents=users.filter(a=>a.refs.some(ref=>ref.path.toLowerCase()===source.path.toLowerCase()&&!require('./manifest.cjs').isRegistration(a,ref)));
        if(dependents.length)throw Error('资产仍被引用：'+dependents.map(a=>a.path).join('、'));
      } else {
        destination=cleanRelative(request.path);
        if(path.extname(destination)!==extensions[source.type])throw Error('目标必须保留类型后缀');
        if(await fs.stat(await this.resolve(destination,true)).catch(()=>null))throw Error('目标已存在');
        // A filesystem move keeps the document identity and all source references stable.
        entries.push([destination,doc.text]);
      }
      entries.push([source.path,null]);
    } else throw Error('未知资产操作');
    if(destination?.endsWith('.rig'))for(const folder of ['PipelineAssets']) {
      const rel=path.posix.join(path.posix.dirname(destination),folder,'.gitkeep');
      if(!await fs.stat(await this.resolve(rel,true)).catch(()=>null))entries.push([rel,'']);
    }
    await require('./manifest.cjs').registerChanges(this,entries,snap,{moves:request.kind==='move'?{[source.path]:destination}:{},copies:request.kind==='copy'||request.kind==='create-asset'&&source?{[source.path]:destination}:{}});
    const check=await this.validate(Object.fromEntries(entries));
    if(check.issues.some(i=>i.severity==='error'))throw Error(check.issues.filter(i=>i.severity==='error').map(i=>i.path+' '+i.message).join('\n'));

    await this.assertUnchanged(snap);
    if(destination&&await fs.stat(await this.resolve(destination,true)).catch(()=>null))throw Error('校验期间目标文件被创建，已取消操作');
    const before=[];for(const [rel] of entries)before.push([rel,await this.read(rel).then(d=>d.text).catch(e=>{if(e.code==='ENOENT')return null;throw e;})]);
    const backup=await this.backup(before,request.kind);
    try{for(const [rel,text]of entries){if(text!==null)await this.atomic(rel,text);else await fs.unlink(await this.resolve(rel));}}
    catch(e){for(const [rel,text]of before){if(text!==null)await this.atomic(rel,text);else await fs.unlink(await this.resolve(rel,true)).catch(()=>{});}throw e;}
    return {path:destination,backup,updated:entries.filter(([rel,text])=>text!==null&&rel!==destination).map(([rel])=>rel)};
  }
}
module.exports={Project,extensions,hash,json,encode,references,cleanRelative};
