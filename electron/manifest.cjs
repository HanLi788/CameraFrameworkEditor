const path=require('node:path');
const {typeOf,assetKey,references,indexPath,documentId,documentReference}=require('./asset-protocol.cjs');
const roots={Shared:'Assets/Shared/Framework.share',Camera:'Assets/GameplayCameraSystem/Framework.camera',PostProcessingSystem:'Assets/PostProcessingSystem/Framework.postProcessing'};
const ownerOf=file=>/^Assets\/(Shared|GameplayCameraSystem|PostProcessingSystem)\//.exec(file)?.[1]?.replace('GameplayCameraSystem','Camera');
function newIdentity(file){
 const owner=ownerOf(file);if(!owner)throw Error('资产必须位于 Shared、GameplayCameraSystem 或 PostProcessingSystem 所有权目录');
 const id=assetKey(file).replace(/^GameplayCameraSystem\/(?:CameraAssets\/)?/,'Camera/').replace('/ValueAssets/','/Values/');
 if(Buffer.byteLength(id)>96)throw Error('新资产的文档身份超过 96 字节，请缩短文件名或目录');
 return id;
}
// Index, sources and framework registrations commit together. A move preserves identity.
async function registerChanges(project,entries,snapshot,{moves={},copies={}}={}){
 const changes=new Map(entries),index=structuredClone(snapshot.documentIndex),documents=new Map(),created=[];
 const movedSources=new Set(Object.keys(moves)),movedTargets=new Set(Object.values(moves));
 for(const file of [...Object.keys(moves),...Object.values(moves)]){
  if(file===indexPath||Object.values(roots).includes(file))throw Error('不能移动文档索引或 Framework 入口');
 }
 const removed=index.Documents.filter(d=>changes.get('Assets/'+d.Path)===null&&!movedSources.has('Assets/'+d.Path));
 const removedIds=new Set(removed.map(d=>d.DocumentId));
 index.Documents=index.Documents.filter(d=>!removedIds.has(d.DocumentId));
 for(const definition of index.Documents){const destination=moves['Assets/'+definition.Path];if(destination){if(!ownerOf(destination))throw Error('资产目标必须位于所有权目录');definition.Path=assetKey(destination);}}
 for(const [file,text] of entries){
  if(text===null||!typeOf(file)||snapshot.assets.some(a=>a.path===file)||movedTargets.has(file))continue;
  const identity=newIdentity(file);
  if(index.Documents.some(d=>d.DocumentId.toLowerCase()===identity.toLowerCase()))throw Error('文档身份已存在：'+identity+'；请选择其他文件名或目录');
  const definition={DocumentId:identity,Path:assetKey(file)};index.Documents.push(definition);created.push(definition);
 }
 const copyIds=new Map();
 for(const [source,destination] of Object.entries(copies)){
  const original=snapshot.assets.find(a=>a.path===source),copy=index.Documents.find(d=>'Assets/'+d.Path===destination);
  if(original&&copy)copyIds.set(original.documentId,copy.DocumentId);
 }
 for(const definition of created){
  const file='Assets/'+definition.Path,data=JSON.parse(changes.get(file));let changed=false;
  for(const ref of references(data))if(copyIds.has(ref.documentId)){
   let node=data;for(const part of ref.parts.slice(0,-1))node=node[part];node[ref.parts.at(-1)]=documentReference(copyIds.get(ref.documentId));changed=true;
  }
  if(changed)changes.set(file,JSON.stringify(data,null,2)+'\n');
 }
 for(const manifest of Object.values(roots)){
  const text=changes.has(manifest)?changes.get(manifest):(await project.read(manifest)).text;
  if(text===null)throw Error('不能删除 Framework 入口');
  const data=JSON.parse(text);let changed=false;
  if(Array.isArray(data.Assets)){const keep=data.Assets.filter(ref=>!removedIds.has(documentId(ref)));changed=keep.length!==data.Assets.length;data.Assets=keep;}
  if(Array.isArray(data.Rigs)){const keep=data.Rigs.filter(r=>!removedIds.has(documentId(r.Asset)));changed||=keep.length!==data.Rigs.length;data.Rigs=keep;}
  if(data.Processors)for(const stage of ['VirtualInput','Filter','Effects']){
   const list=data.Processors[stage].Assets,keep=list.filter(m=>!removedIds.has(documentId(m.Asset)));changed||=keep.length!==list.length;data.Processors[stage].Assets=keep;
  }
  if(changed)documents.set(manifest,data);
 }
 for(const definition of created){
  const file='Assets/'+definition.Path,owner=definition.DocumentId.split('/')[0],manifest=roots[owner];
  const candidates=snapshot.assets.map(a=>({path:moves[a.path]||a.path,data:changes.has(a.path)?(changes.get(a.path)===null?null:JSON.parse(changes.get(a.path))):a.data}));
  for(const d of created)candidates.push({path:'Assets/'+d.Path,data:JSON.parse(changes.get('Assets/'+d.Path))});
  if(candidates.some(a=>a.path!==file&&a.data&&references(a.data).some(r=>r.documentId===definition.DocumentId)))continue;
  let data=documents.get(manifest);if(!data){data=JSON.parse(changes.get(manifest)??(await project.read(manifest)).text);documents.set(manifest,data);}
  const ref=documentReference(definition.DocumentId),asset=JSON.parse(changes.get(file));
  if(owner==='Camera'&&typeOf(file)==='Rig'){
   const pipeline=index.Documents.find(d=>d.DocumentId===documentId(asset.Pipelines?.[0]));if(!pipeline)throw Error('装置必须挂载已登记管线');
   const pipelineFile='Assets/'+pipeline.Path,config=JSON.parse(changes.get(pipelineFile)??(await project.read(pipelineFile)).text);
   if(config.SpaceType==='Idle')data.Assets.push(ref);
   else{
    let name=path.posix.basename(file,'.rig');const taken=name=>data.Rigs.some(r=>r.CameraType===config.SpaceType&&r.Name.toLowerCase()===name.toLowerCase());
    if(taken(name)){const base=path.posix.basename(path.posix.dirname(file))+'_'+name;name=base;for(let suffix=2;taken(name);suffix++)name=base+'_'+suffix;}
    asset.Name=name;changes.set(file,JSON.stringify(asset,null,2)+'\n');data.Rigs.push({CameraType:config.SpaceType,Name:name,Asset:ref});
   }
  }else if(owner==='Shared'||owner==='Camera')data.Assets.push(ref);
  else{
   const kind=typeOf(file),stage=kind==='Filter'?'Filter':kind==='VirtualInput'?'VirtualInput':['NumEffect','BoolEffect'].includes(kind)?'Effects':null;
   if(!stage)throw Error('后处理目录仅支持后处理资产');
   data.Processors[stage].Assets.push({Asset:ref,...(stage==='Filter'?{}:{Context:asset.Source?.Object||'World'})});
  }
 }
 for(const [file,data] of documents)changes.set(file,JSON.stringify(data,null,2)+'\n');
 if(JSON.stringify(index)!==JSON.stringify(snapshot.documentIndex))changes.set(indexPath,JSON.stringify(index,null,2)+'\n');
 entries.splice(0,entries.length,...changes);
}
const isRegistration=(asset,ref)=>Object.values(roots).includes(asset.path)&&(/^Assets\.\d+$/.test(ref.field)||/^Rigs\.\d+\.Asset$/.test(ref.field)||/^Processors\.(VirtualInput|Effects|Filter)\.Assets\.\d+\.Asset$/.test(ref.field));
module.exports={registerChanges,isRegistration,newIdentity};
