const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateRuntime } = require('./validation.cjs');
const extensions = {Rig:'.rig', Pipeline:'.pipeline', Input:'.input', Effect:'.effect', Range:'.range', Sensitivity:'.sensitivity', Occlusion:'.occlusion', Smooth:'.smooth', Curve:'.curve', Value:'.value'};
const versions = {Rig:12, Pipeline:1, Effect:4, Range:4, Sensitivity:1, Occlusion:3, Smooth:1, Curve:2, Value:1};
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const json = text => JSON.parse(text.replace(/^\uFEFF/, ''));
const encode = data => JSON.stringify(data, null, 2) + '\n';
const slash = p => p.split(path.sep).join('/');
const isInside = (root,p) => p === root || (!path.relative(root,p).startsWith('..'+path.sep) && path.relative(root,p) !== '..' && !path.isAbsolute(path.relative(root,p)));
function cleanRelative(p) {
  if (typeof p !== 'string' || !p || /[\\:\x00-\x1f<>"|?*]/.test(p) || p.split('/').some(x => !x || x==='.' || x==='..' || /[. ]$/.test(x) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(x))) throw Error('路径必须是框架内的有效相对路径');
  return p;
}
function references(value, at = '', found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key,v] of Object.entries(value)) {
    const field = at ? `${at}.${key}` : key;
    if (typeof v === 'string' && (key === 'AssetId' || key.endsWith('AssetId') || ['Curve','ResponseCurve','LowerCurve','UpperCurve'].includes(key))) {
      let type = /Curve$/.test(key) ? 'Curve' : key==='PipelineAssetId' ? 'Pipeline' : key==='RangeAssetId' ? 'Range' : undefined;
      if (key==='AssetId') type = /(^|\.)ValueAssets\./.test(at)?'Value': /SensitivityAssets/.test(at)?'Sensitivity': /(^|\.)Ranges\./.test(at)?'Range': /\.Effects\./.test(at)?'Effect': /\.Smooth$/.test(at)?'Smooth': /\.Occlusion$/.test(at)?'Occlusion': /\.Sources\./.test(at)?'Input': undefined;
      found.push({id:v,field,type});
    } else if (v && typeof v==='object') references(v,field,found);
  }
  return found;
}
class Project {
  constructor(root, storage, runtime) {this.root=root; this.storage=storage; this.runtime=runtime; this.queue=Promise.resolve();}
  static async open(root,storage,runtime) {
    root = await fs.realpath(root);
    if (!await fs.stat(path.join(root,'Assets','Index.json')).catch(()=>null)) {
      root = await fs.realpath(path.join(root,'CameraFramework')).catch(()=>{throw Error('请选择 CameraFramework 目录，或包含它的 Lua 目录');});
    }
    const p = new Project(root,storage,runtime);
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
    return {path:relative,text,revision:hash(text)};
  }
  async snapshot(overrides={}) {
    const indexDoc=await this.read('Assets/Index.json');
    const index=json(overrides['Assets/Index.json'] ?? indexDoc.text);
    if(index.SchemaVersion!==1 || !index.Assets || Array.isArray(index.Assets)) throw Error('资产索引必须使用 SchemaVersion 1 和 Assets 对象');
    const files=[], directories=['']; const issues=[]; const assets=[]; const seen=new Set();
    const walk=async (dir='')=>{for(const d of await fs.readdir(path.join(this.root,dir),{withFileTypes:true})) {
      if(d.isSymbolicLink()||['.git','node_modules','.editor'].includes(d.name))continue;
      const rel=dir?`${dir}/${d.name}`:d.name;
      if(d.isDirectory()){directories.push(rel);await walk(rel);}else if(d.isFile())files.push({path:rel,name:d.name,dir,extension:path.extname(d.name).toLowerCase()});
    }};
    await walk();
    for (const [id,entry] of Object.entries(index.Assets)) {
      const rel='Assets/'+entry.Path;
      const asset={id,type:entry.Type,path:rel,data:null,refs:[]}; assets.push(asset);
      try {
        if(!id.trim() || !extensions[entry.Type])throw Error('未知资产类型或空 ID');
        cleanRelative(entry.Path);
        if(path.extname(entry.Path)!==extensions[entry.Type])throw Error('文件后缀与资产类型不一致');
        if(seen.has(entry.Path.toLowerCase()))throw Error('同一文件被重复登记'); seen.add(entry.Path.toLowerCase());
        asset.data=json(overrides[rel] ?? (await this.read(rel)).text);
        if(asset.data.Id!==id)throw Error('文件 Id 与索引键不一致');
        const expected=entry.Type==='Input'?(asset.data.Type==='Transition'?3:1):versions[entry.Type];
        if(asset.data.SchemaVersion!==expected)throw Error(`不支持的资产版本，当前要求 ${expected}`);
        asset.refs=references(asset.data);
      } catch(e) {issues.push({path:rel,field:'',message:e.message,severity:'error'});}
    }
    const map=new Map(assets.map(a=>[a.id,a]));
    for(const a of assets)for(const ref of a.refs){const target=map.get(ref.id); if(!target || ref.type && target.type!==ref.type)issues.push({path:a.path,field:ref.field,message:!target?`引用不存在：${ref.id}`:`引用 ${ref.id} 应为 ${ref.type} 类型`,severity:'error'});}
    for(const f of files) if(Object.values(extensions).includes(f.extension)&&!assets.some(a=>a.path.toLowerCase()===f.path.toLowerCase()))issues.push({path:f.path,field:'Id',message:'资产尚未登记到 Assets/Index.json',severity:'warning'});
    return {root:this.root,index,indexRevision:indexDoc.revision,files,directories,assets,issues};
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
      if(seen.has(relative.toLowerCase()))throw Error('重复保存路径');seen.add(relative.toLowerCase());
      const doc=await this.read(relative);if(doc.revision!==revision)throw Error('文件已被外部修改。请重新载入或复制草稿后合并；没有覆盖磁盘内容。');
      if(relative==='Assets/Index.json')throw Error('索引由资产管理操作维护，请通过新建、移动或登记资产修改');
      if(typeof text!=='string'||Buffer.byteLength(text)>8*1024*1024)throw Error('文本过大');
      const asset=snap.assets.find(a=>a.path===relative);
      if(asset){if(json(text).Id!==asset.id)throw Error('资产 ID 是稳定引用，不能在表单中直接修改；请复制为新资产');hasAsset=true;}
      else if(Object.values(extensions).includes(path.extname(relative)))throw Error('请先登记此资产，再编辑保存');
      before.push([relative,doc.text]);overrides[relative]=text;
    }
    if(hasAsset){const check=await this.validate(overrides);if(check.issues.some(i=>i.severity==='error'))throw Error(check.issues.filter(i=>i.severity==='error').map(i=>i.path+' '+i.message).join('\n'));}
    for(const d of requests)if((await this.read(d.path)).revision!==d.revision)throw Error('校验期间磁盘文件发生变化，请重新载入');
    if((await this.read('Assets/Index.json')).revision!==snap.indexRevision)throw Error('校验期间资产索引发生变化，请刷新后重试');
    const backup=await this.backup(before,'save');
    try{for(const d of requests)await this.atomic(d.path,d.text);}
    catch(e){for(const [rel,text]of before)await this.atomic(rel,text);throw e;}
    return Promise.all(requests.map(async d=>({...await this.read(d.path),backup})));
  });}
  mutate(request){return this.serial(async()=>{
    const snap=await this.snapshot();
    if(request.indexRevision!==snap.indexRevision)throw Error('索引已变化，请刷新后重试');
    const index=structuredClone(snap.index); const entries=[];
    const source=snap.assets.find(a=>a.id===request.sourceId);
    let destination;
    if(request.kind==='copy'||request.kind==='create-curve') {
      const creating=request.kind==='create-curve',type=creating?'Curve':source?.type;
      if(!creating&&!source?.data)throw Error('请选择有效模板资产');
      if(creating&&!['Bezier','CubicHermiteSpline'].includes(request.parentType))throw Error('不支持的曲线父类型');
      if(typeof request.id!=='string'||!request.id.trim()||/[\x00-\x1f]/.test(request.id)||Object.hasOwn(index.Assets,request.id))throw Error('新资产 ID 不能为空或重复');
      destination=cleanRelative(request.path);
      if(!destination.startsWith('Assets/')||path.extname(destination)!==extensions[type])throw Error('新资产必须位于 Assets 内，且保留类型后缀');
      if(await fs.stat(await this.resolve(destination,true)).catch(()=>null))throw Error('目标文件已存在');
      const data=creating?{SchemaVersion:2,Id:request.id,ParentType:request.parentType,...(request.parentType==='Bezier'?{P1:{X:0,Y:0},P2:{X:1/3,Y:1/3},P3:{X:2/3,Y:2/3},P4:{X:1,Y:1}}:{Points:[{X:0,Y:0,Tangent:0},{X:1,Y:1,Tangent:0}]})}:structuredClone(source.data);data.Id=request.id;
      entries.push([destination,encode(data)]);Object.defineProperty(index.Assets,request.id,{value:{Type:type,Path:destination.slice(7)},enumerable:true,writable:true,configurable:true});
    } else if(request.kind==='move'||request.kind==='delete') {
      if(!source)throw Error('资产不存在');
      const doc=await this.read(source.path);if(request.sourceRevision!==doc.revision)throw Error('源文件已变化，请刷新后重试');
      if(request.kind==='delete') {
        const users=snap.assets.filter(a=>a.id!==source.id&&a.refs.some(r=>r.id===source.id));
        if(users.length)throw Error('资产仍被引用：'+users.map(a=>a.id).join('、'));
        delete index.Assets[source.id];
      } else {
        destination=cleanRelative(request.path);
        if(!destination.startsWith('Assets/')||path.extname(destination)!==extensions[source.type])throw Error('目标必须位于 Assets 内，并保留后缀');
        if(await fs.stat(await this.resolve(destination,true)).catch(()=>null))throw Error('目标已存在');
        entries.push([destination,doc.text]);index.Assets[source.id].Path=destination.slice(7);
      }
      entries.push([source.path,null]);
    } else if(request.kind==='register') {
      destination=cleanRelative(request.path);if(!destination.startsWith('Assets/'))throw Error('资产须位于 Assets 内');
      const data=json((await this.read(destination)).text);const type=Object.keys(extensions).find(t=>extensions[t]===path.extname(destination));
      if(!type||typeof data.Id!=='string'||!data.Id.trim()||Object.hasOwn(index.Assets,data.Id))throw Error('资产类型或 Id 无效，或 Id 已登记');
      Object.defineProperty(index.Assets,data.Id,{value:{Type:type,Path:destination.slice(7)},enumerable:true,writable:true,configurable:true});
    } else throw Error('未知资产操作');
    entries.push(['Assets/Index.json',encode(index)]);
    const overlays=Object.fromEntries(entries.filter(([,text])=>text!==null));
    const check=await this.validate(overlays);
    if(check.issues.some(i=>i.severity==='error'))throw Error(check.issues.filter(i=>i.severity==='error').map(i=>i.message).join('\n'));
    if((await this.read('Assets/Index.json')).revision!==snap.indexRevision)throw Error('校验期间索引发生变化');
    if(destination&&['copy','move','create-curve'].includes(request.kind)&&await fs.stat(await this.resolve(destination,true)).catch(()=>null))throw Error('校验期间目标文件被创建，已取消操作');
    const before=[];for(const [rel] of entries) before.push([rel,await this.read(rel).then(d=>d.text).catch(e=>{if(e.code==='ENOENT')return null;throw e;})]);
    if(source&&request.sourceRevision&&(await this.read(source.path)).revision!==request.sourceRevision)throw Error('校验期间源文件发生变化');
    const backup=await this.backup(before,request.kind);
    try {for(const [rel,text]of entries){if(text!==null)await this.atomic(rel,text);else await fs.unlink(await this.resolve(rel));}}
    catch(e){for(const [rel,text]of before){if(text!==null)await this.atomic(rel,text);else await fs.unlink(await this.resolve(rel,true)).catch(()=>{});}throw e;}
    return {path:destination,backup};
  });}
}
module.exports={Project,extensions,hash,json,encode,references,cleanRelative};
