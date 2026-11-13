const {typeOf,assetKey,references}=require('./asset-protocol.cjs');
const roots={Shared:'Assets/Shared/Framework.share',GameplayCameraSystem:'Assets/GameplayCameraSystem/Framework.camera',PostProcessingSystem:'Assets/PostProcessingSystem/Framework.postProcessing'};
// Register newly created standalone assets in their owner manifest in the same transaction.
async function registerChanges(project,entries,snapshot){
 const changes=new Map(entries),documents=new Map();
 const deleted=new Set(entries.filter(([,text])=>text===null).map(([file])=>assetKey(file)));
 for(const manifest of Object.values(roots)){
  const source=changes.has(manifest)?changes.get(manifest):(await project.read(manifest)).text;
  if(source===null)throw Error('不能删除 Framework 入口');
  const data=JSON.parse(source);let changed=false;
  if(Array.isArray(data.Assets)){const keep=data.Assets.filter(key=>!deleted.has(key));changed=keep.length!==data.Assets.length;data.Assets=keep;}
  if(Array.isArray(data.Rigs)){const keep=data.Rigs.filter(r=>!deleted.has(r.Asset));if(keep.length!==data.Rigs.length){data.Rigs=keep;changed=true;}}
  if(data.Processors)for(const stage of ['VirtualInput','Filter','Effects']){const list=data.Processors[stage].Assets;const keep=list.filter(m=>!deleted.has(m.Asset));if(keep.length!==list.length){data.Processors[stage].Assets=keep;changed=true;}}
  if(changed)documents.set(manifest,data);
 }

 for(const [file,text]of entries){
  if(text===null||!typeOf(file)||snapshot.assets.some(a=>a.path===file)||Object.values(roots).includes(file))continue;
  const key=assetKey(file),owner=key.split('/')[0],manifest=roots[owner];
  if(!manifest)throw Error('资产必须位于 Shared、GameplayCameraSystem 或 PostProcessingSystem 所有权目录');
  // A move already rewrites the existing registration. Avoid an additional mount.
  const candidates=snapshot.assets.map(a=>({path:a.path,data:changes.has(a.path)?(changes.get(a.path)===null?null:JSON.parse(changes.get(a.path))):a.data}));
  if(candidates.some(a=>a.path!==file&&a.data&&references(a.data).some(r=>r.path===file)))continue;
  let data=documents.get(manifest);if(!data){data=JSON.parse(changes.get(manifest)??(await project.read(manifest)).text);documents.set(manifest,data);}
  if(owner==='GameplayCameraSystem'&&typeOf(file)==='Rig'){
   const asset=JSON.parse(text),pipelineFile='Assets/'+asset.Pipelines[0],pipeline=JSON.parse(changes.get(pipelineFile)??(await project.read(pipelineFile)).text);
   if(pipeline.SpaceType==='Idle'){data.Assets.push(key);}else{const name=require('node:path').posix.basename(file,'.rig');if(data.Rigs.some(r=>r.CameraType===pipeline.SpaceType&&r.Name.toLowerCase()===name.toLowerCase()))throw Error('装置名称重复：'+name);data.Rigs.push({CameraType:pipeline.SpaceType,Name:name,Asset:key});}
  }else if(owner==='Shared'||owner==='GameplayCameraSystem'){if(!data.Assets.includes(key))data.Assets.push(key);}
  else{const kind=typeOf(file),stage=kind==='Filter'?'Filter':kind==='VirtualInput'?'VirtualInput':kind==='NumEffect'||kind==='BoolEffect'?'Effects':null;if(!stage)throw Error('后处理目录仅支持后处理资产');const asset=JSON.parse(text);data.Processors[stage].Assets.push({Asset:key,...(stage==='Filter'?{}:{Context:asset.Source?.Object||'World'})});}
 }
 for(const [file,data]of documents){const at=entries.findIndex(([p])=>p===file),entry=[file,JSON.stringify(data,null,2)+'\n'];if(at<0)entries.push(entry);else entries[at]=entry;}
}
const isRegistration=(asset,ref)=>Object.values(roots).includes(asset.path)&&(/^Assets\.\d+$/.test(ref.field)||/^Rigs\.\d+\.Asset$/.test(ref.field)||/^Processors\.(VirtualInput|Effects|Filter)\.Assets\.\d+\.Asset$/.test(ref.field));
module.exports={registerChanges,isRegistration};
