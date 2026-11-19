const path=require('node:path');
const {extensions,assetKey,references,indexPath}=require('./asset-protocol.cjs');
const {inputIssues}=require('./input-catalog.cjs');

// Build the same index/reference view from cached texts or an unsaved overlay, without disk I/O.
function buildView(base,overrides,{hash,json,cleanRelative}){
 const files=base.files.map(file=>({...file})),directories=[...base.directories],issues=[],assets=[],seen=new Set();
 const textOf=file=>Object.hasOwn(overrides,file)?overrides[file]:base.texts.get(file);
 let documentIndex={Documents:[]},indexRevision='';const registeredPaths=new Map(),registeredIds=new Map();
 try{
  const text=textOf(indexPath);indexRevision=hash(text||'');documentIndex=json(text);
  if(!documentIndex||!Array.isArray(documentIndex.Documents))throw Error('文档索引 Documents 必须为数组');
  for(const entry of documentIndex.Documents){
   if(!entry||typeof entry.DocumentId!=='string'||!entry.DocumentId||Buffer.byteLength(entry.DocumentId)>96)throw Error('文档身份必须为 1～96 字节的字符串');
   cleanRelative(entry.Path);const file='Assets/'+entry.Path;
   if(registeredPaths.has(file.toLowerCase())||registeredIds.has(entry.DocumentId))throw Error('文档索引存在重复身份或文件路径：'+entry.DocumentId);
   registeredPaths.set(file.toLowerCase(),entry);registeredIds.set(entry.DocumentId,entry);
  }
 }catch(error){issues.push({path:indexPath,field:'',message:'文档索引无效：'+error.message,severity:'error'});}
 for(const [relative,text]of Object.entries(overrides)){
  cleanRelative(relative);const index=files.findIndex(file=>file.path===relative);
  if(text===null){if(index>=0)files.splice(index,1);}
  else if(index<0)files.push({path:relative,name:path.posix.basename(relative),dir:path.posix.dirname(relative)==='.'?'':path.posix.dirname(relative),extension:path.extname(relative).toLowerCase()});
 }
 files.sort((a,b)=>a.path.localeCompare(b.path));
 for(const file of files){
  if(['.switchviewpointinput','.switchviewpointvalue'].includes(file.extension)){issues.push({path:file.path,field:'',severity:'error',message:'已移除的资产后缀，请迁移为 Enter / Change / Exit 的 .transitionInput 与 .transitionValue'});continue;}
  const type=Object.keys(extensions).find(type=>extensions[type].toLowerCase()===file.extension);if(!type)continue;
  const asset={type,path:file.path,documentId:registeredPaths.get(file.path.toLowerCase())?.DocumentId,data:null,refs:[],revision:''};assets.push(asset);
  try{
   cleanRelative(file.path);if(path.extname(file.path)!==extensions[type])throw Error('资产后缀大小写不符合类型约定');
   if(seen.has(file.path.toLowerCase()))throw Error('资产路径大小写冲突');seen.add(file.path.toLowerCase());
   const text=textOf(file.path);asset.revision=hash(text);asset.data=json(text);
   if(!asset.data||typeof asset.data!=='object'||Array.isArray(asset.data))throw Error('资产必须为 JSON 对象');
   if(!asset.documentId)throw Error('文档索引未覆盖资产，请登记 Documents.index.json');
   if(registeredPaths.get(file.path.toLowerCase()).Path!==assetKey(file.path))throw Error('文档索引路径大小写不匹配');
   if(Object.hasOwn(asset.data,'Id'))throw Error('源资产不保存根 Id，身份来自 Documents.index.json');
   if(asset.data.SchemaVersion!==1)throw Error('不支持的资产版本，当前要求 1；旧结构不能仅修改版本号');
   asset.refs=references(asset.data,[],[],documentIndex.Documents);
  }catch(error){issues.push({path:file.path,field:'',message:error.message,severity:'error'});}
 }
 const map=new Map(assets.map(asset=>[asset.path,asset]));
 for(const entry of registeredIds.values())if(!map.has('Assets/'+entry.Path))issues.push({path:indexPath,field:'Documents',message:'已登记的资产文件不存在：'+entry.Path,severity:'error'});
 for(const asset of assets)for(const ref of asset.refs){try{
  if(!registeredIds.has(ref.documentId))throw Error('引用的文档未登记：'+String(ref.documentId));
  if(ref.pointer!=='')throw Error('相机挂载必须引用完整文档，Pointer 必须为空字符串');
  cleanRelative(ref.path);const target=map.get(ref.path);if(!target)throw Error('引用不存在（检查路径及大小写）：'+ref.path);
  if(target.type!==ref.type)throw Error('引用 '+ref.path+' 应为 '+ref.type+' 类型');
 }catch(error){issues.push({path:asset.path,field:ref.field,message:error.message,severity:'error'});}}
 issues.push(...base.effectCatalog.issues,...base.inputCatalog.issues);for(const asset of assets)issues.push(...inputIssues(asset,base.inputCatalog));
 return {root:base.root,workspaceRoot:base.workspaceRoot,documentIndex,indexRevision,snapshotRevision:hash(JSON.stringify([indexRevision,assets.map(asset=>[asset.path,asset.revision]),base.inputCatalog.revision,base.effectCatalog.revision])),files,directories,assets,issues,inputCatalog:base.inputCatalog,effectCatalog:base.effectCatalog};
}
module.exports={buildView};
