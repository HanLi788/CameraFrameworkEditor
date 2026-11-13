import {assetFile,collectAssetReferences} from './assetPaths.mjs';
const spaceOrder=['Action','Battle','Idle','Interactive','Preview'];
export function rigChoicesBySpace(assets){
 const index=new Map(assets.map(a=>[a.path,a])),groups=new Map();
 for(const rig of assets.filter(a=>a.type==='Rig')){
  const pipeline=index.get(assetFile(rig.data?.Pipelines?.[0]||''));
  const declared=pipeline?.type==='Pipeline'?pipeline.data?.SpaceType:undefined;
  const directory=/^Assets\/GameplayCameraSystem\/CameraAssets\/(Action|Battle|Idle|Interactive|Preview)Camera\//.exec(rig.path)?.[1];
  const space=spaceOrder.includes(declared)?declared:directory||'Unassigned';
  const name=typeof rig.data?.Name==='string'&&rig.data.Name.trim()?rig.data.Name:rig.path.split('/').at(-1).replace(/\.rig$/,'');
  if(!groups.has(space))groups.set(space,[]);
  groups.get(space).push({path:rig.path,name});
 }
 return [...groups].sort(([a],[b])=>spaceOrder.concat('Unassigned').indexOf(a)-spaceOrder.concat('Unassigned').indexOf(b)).map(([space,rigs])=>({space,rigs:rigs.sort((a,b)=>a.name.localeCompare(b.name)||a.path.localeCompare(b.path))}));
}
export function processorPipeline(assets,rigPath){
 const rig=assets.find(a=>a.path===rigPath&&a.type==='Rig');
 const pipelinePath=assetFile(rig?.data?.Pipelines?.[0]||'');
 const pipeline=assets.find(a=>a.path===pipelinePath&&a.type==='Pipeline');
 const stages=pipeline?.data?.Stages||{};
 const names=value=>Array.isArray(value)?value.filter(n=>typeof n==='string'):[];
 const make=(name,enabled)=>({name,enabled,implementation:stages[name]?.Implementation||'',configured:Object.hasOwn(rig?.data?.Processors||{},name)});
 return {rig,pipeline,pipelinePath,flow:names(pipeline?.data?.Flow).map(n=>make(n,true)),disabled:names(pipeline?.data?.Disabled).map(n=>make(n,false))};
}
export function processorReferences(rig,stage){
 return collectAssetReferences({value:rig?.data?.Processors?.[stage]}).map(r=>r.path);
}
