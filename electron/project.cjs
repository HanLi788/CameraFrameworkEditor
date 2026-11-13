const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {InputCatalog,inputIssues}=require('./input-catalog.cjs');
const {EffectCatalog}=require('./effect-catalog.cjs');
const {generated,writable}=require('./postprocessing.cjs');
const { validateRuntime } = require('./validation.cjs');
const {extensions,typeOf,assetKey,references}=require('./asset-protocol.cjs');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const json = text => JSON.parse(text.replace(/^\uFEFF/, ''));
const encode = data => JSON.stringify(data, null, 2) + '\n';
const slash = p => p.split(path.sep).join('/');
const isInside = (root,p) => p === root || (!path.relative(root,p).startsWith('..'+path.sep) && path.relative(root,p) !== '..' && !path.isAbsolute(path.relative(root,p)));
function cleanRelative(p) {
  if (typeof p !== 'string' || !p || /[\\:\x00-\x1f<>"|?*]/.test(p) || p.split('/').some(x => !x || x==='.' || x==='..' || /[. ]$/.test(x) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(x))) throw Error('路径必须是框架内的有效相对路径');
  return p;
}
function replaceReferences(data,source,destination) {
  const result=structuredClone(data);
  for(const ref of references(result))if(ref.path.toLowerCase()===source.toLowerCase()) {
    let node=result;for(const part of ref.parts.slice(0,-1))node=node[part];node[ref.parts.at(-1)]=assetKey(destination);
  }
  return result;
}
class Project {
  constructor(root, storage, runtime) {this.root=root; this.workspaceRoot=path.dirname(root); this.storage=storage; this.runtime=runtime; this.inputCatalogProvider=new InputCatalog(); this.effectCatalogProvider=new EffectCatalog(); this.queue=Promise.resolve();}
  static async open(root,storage,runtime) {
    root = await fs.realpath(root);
    const isFramework=async dir=>Boolean(await fs.stat(path.join(dir,'Editor','Workspace.lua')).catch(()=>null));
    if(!await isFramework(root))root=await fs.realpath(path.join(root,'CameraFramework')).catch(()=>{throw Error('请选择包含 CameraFramework、InputSystem、Foundation 的 Lua 工作区目录');});
    if(!await isFramework(root))throw Error('所选目录不支持当前路径资产协议，请先更新 Lua 相机框架');
    const p = new Project(root,storage,runtime);
    for(const required of ['InputSystem/InputManager.lua','InputSystem/MyIMC/Definition/Definitions','Foundation/Math/Vector3D.lua']){
      if(!await fs.stat(path.join(p.workspaceRoot,required)).catch(()=>null))throw Error('Lua 工作区缺少依赖：'+required);
    }
    await p.snapshot(); return p;
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
    const full=await this.resolve(relative); const stat=await fs.stat(full);
    if(!stat.isFile()||stat.size>8*1024*1024) throw Error('仅支持 8 MB 以内的文本文件');
    const bytes=await fs.readFile(full); if(bytes.includes(0)) throw Error('此文件为二进制文件，不能作为文本打开');
    let text; try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw Error('文件不是有效的 UTF-8 文本');}
    return {path:relative,text,revision:hash(text),readOnly:generated(relative)};
  }
  async snapshot(overrides={}) {
    const files=[],directories=[''],issues=[],assets=[],seen=new Set();
    const walk=async(dir='')=>{for(const d of await fs.readdir(path.join(this.root,dir),{withFileTypes:true})) {
      if(d.isSymbolicLink()||['.git','node_modules','.editor'].includes(d.name))continue;
      const rel=dir?`${dir}/${d.name}`:d.name;
      if(d.isDirectory()){directories.push(rel);await walk(rel);}else if(d.isFile())files.push({path:rel,name:d.name,dir,extension:path.extname(d.name).toLowerCase()});
    }};
    await walk();
    // Overlay additions and deletions participate in exactly the same scan as disk assets.
    for(const [rel,text] of Object.entries(overrides)) {
      cleanRelative(rel);
      const i=files.findIndex(f=>f.path===rel);
      if(text===null){if(i>=0)files.splice(i,1);}
      else if(i<0)files.push({path:rel,name:path.posix.basename(rel),dir:path.posix.dirname(rel)==='.'?'':path.posix.dirname(rel),extension:path.extname(rel).toLowerCase()});
    }
    files.sort((a,b)=>a.path.localeCompare(b.path));
    for(const f of files) {
      if(['.switchviewpointinput','.switchviewpointvalue'].includes(f.extension)){issues.push({path:f.path,field:'',severity:'error',message:'已移除的资产后缀，请迁移为 Focus / Unfocus 的 .transitionInput 与 .transitionValue'});continue;}
      const type=Object.keys(extensions).find(t=>extensions[t].toLowerCase()===f.extension);if(!type)continue;
      const asset={type,path:f.path,data:null,refs:[],revision:''};assets.push(asset);
      try {
        cleanRelative(f.path);if(path.extname(f.path)!==extensions[type])throw Error('资产后缀大小写不符合类型约定');
        if(seen.has(f.path.toLowerCase()))throw Error('资产路径大小写冲突');seen.add(f.path.toLowerCase());
        const text=Object.hasOwn(overrides,f.path)?overrides[f.path]:(await this.read(f.path)).text;
        asset.revision=hash(text);asset.data=json(text);
        if(!asset.data||typeof asset.data!=='object'||Array.isArray(asset.data))throw Error('资产必须为 JSON 对象');
        if(Object.hasOwn(asset.data,'Id'))throw Error('新版资产不保存根 Id，请使用相对 CameraFramework 的路径');
        const expected=1;
        if(asset.data.SchemaVersion!==expected)throw Error(`不支持的资产版本，当前要求 ${expected}；旧结构不能仅修改版本号`);
        asset.refs=references(asset.data);
      }catch(e){issues.push({path:f.path,field:'',message:e.message,severity:'error'});}
    }
    const map=new Map(assets.map(a=>[a.path,a]));
    for(const a of assets)for(const ref of a.refs) {
      try{cleanRelative(ref.path);const target=map.get(ref.path);if(!target)throw Error(`引用不存在（检查路径及大小写）：${ref.path}`);if(target.type!==ref.type)throw Error(`引用 ${ref.path} 应为 ${ref.type} 类型`);}
      catch(e){issues.push({path:a.path,field:ref.field,message:e.message,severity:'error'});}
    }

    const inputCatalog=await this.inputCatalogProvider.read(this.workspaceRoot,this.runtime);
    const effectCatalog=await this.effectCatalogProvider.read(this.workspaceRoot,this.runtime,overrides);
    issues.push(...effectCatalog.issues);
    issues.push(...inputCatalog.issues);for(const asset of assets)issues.push(...inputIssues(asset,inputCatalog));
    return {root:this.root,workspaceRoot:this.workspaceRoot,snapshotRevision:hash(JSON.stringify([assets.map(a=>[a.path,a.revision]),inputCatalog.revision,effectCatalog.revision])),files,directories,assets,issues,inputCatalog,effectCatalog};
  }
  async assertUnchanged(snapshot) {
    if((await this.snapshot()).snapshotRevision!==snapshot.snapshotRevision)throw Error('校验期间资产文件发生变化，请刷新后重试');
  }
  async validate(overrides={}) {
    const snap=await this.snapshot(overrides);
    if(snap.issues.some(i=>i.severity==='error'))return {issues:snap.issues,checked:0,runtime:false};
    const result=await validateRuntime(this.root,snap,overrides,this.runtime);
    return {...result,issues:[...snap.issues,...result.issues]};
  }
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
  saveMany(requests) {return this.serial(async()=>{
    if(!Array.isArray(requests)||!requests.length||requests.length>200)throw Error('保存请求无效');
    const snap=await this.snapshot(),before=[],overrides={},seen=new Set();let hasAsset=false;
    for(const {path:relative,text,revision} of requests){
      writable(relative);
      if(seen.has(relative.toLowerCase()))throw Error('重复保存路径');seen.add(relative.toLowerCase());
      const doc=await this.read(relative);if(doc.revision!==revision)throw Error('文件已被外部修改。请重新载入或复制草稿后合并；没有覆盖磁盘内容。');
      if(typeof text!=='string'||Buffer.byteLength(text)>8*1024*1024)throw Error('文本过大');
      const asset=snap.assets.find(a=>a.path===relative);
      if(asset||relative.endsWith('.lua'))hasAsset=true;
      before.push([relative,doc.text]);overrides[relative]=text;
    }
    if(hasAsset){const check=await this.validate(overrides);if(check.issues.some(i=>i.severity==='error'))throw Error(check.issues.filter(i=>i.severity==='error').map(i=>i.path+' '+i.message).join('\n'));}
    for(const d of requests)if((await this.read(d.path)).revision!==d.revision)throw Error('校验期间磁盘文件发生变化，请重新载入');
    if(hasAsset)await this.assertUnchanged(snap);
    const backup=await this.backup(before,'save');
    try{for(const d of requests)await this.atomic(d.path,d.text);}
    catch(e){for(const [rel,text]of before){if(text===null)await fs.unlink(await this.resolve(rel,true)).catch(()=>{});else await this.atomic(rel,text);}throw e;}
    return Promise.all(requests.map(async d=>({...await this.read(d.path),backup})));
  });}
  mutate(request){return this.serial(async()=>{
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
        entries.push([destination,encode(replaceReferences(source.data,source.path,destination))]);
        for(const a of users)entries.push([a.path,encode(replaceReferences(a.data,source.path,destination))]);
      }
      entries.push([source.path,null]);
    } else throw Error('未知资产操作');
    if(destination?.endsWith('.rig'))for(const folder of ['PipelineAssets']) {
      const rel=path.posix.join(path.posix.dirname(destination),folder,'.gitkeep');
      if(!await fs.stat(await this.resolve(rel,true)).catch(()=>null))entries.push([rel,'']);
    }
    await require('./manifest.cjs').registerChanges(this,entries,snap);
    const check=await this.validate(Object.fromEntries(entries));
    if(check.issues.some(i=>i.severity==='error'))throw Error(check.issues.filter(i=>i.severity==='error').map(i=>i.path+' '+i.message).join('\n'));

    await this.assertUnchanged(snap);
    if(destination&&await fs.stat(await this.resolve(destination,true)).catch(()=>null))throw Error('校验期间目标文件被创建，已取消操作');
    const before=[];for(const [rel] of entries)before.push([rel,await this.read(rel).then(d=>d.text).catch(e=>{if(e.code==='ENOENT')return null;throw e;})]);
    const backup=await this.backup(before,request.kind);
    try{for(const [rel,text]of entries){if(text!==null)await this.atomic(rel,text);else await fs.unlink(await this.resolve(rel));}}
    catch(e){for(const [rel,text]of before){if(text!==null)await this.atomic(rel,text);else await fs.unlink(await this.resolve(rel,true)).catch(()=>{});}throw e;}
    return {path:destination,backup,updated:entries.filter(([rel,text])=>text!==null&&rel!==destination).map(([rel])=>rel)};
  });}
}
module.exports={Project,extensions,hash,json,encode,references,cleanRelative};
