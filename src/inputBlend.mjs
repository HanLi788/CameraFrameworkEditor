import {assetFile,assetReference,documentId} from './assetPaths.mjs';
import {rangeChannels} from './rangeChannels.mjs';

export const blendChannels=rangeChannels;
const channelType=name=>name==='AnchorLocOffset'?'Vector':name.startsWith('Rotation')?'Angle':'Scalar';
export function rigInputReferences(rig){
 const input=rig?.data?.Processors?.Input||{},seen=new Set();
 return [...(Array.isArray(input.Assets)?input.Assets:[]),...['Enter','Change','Exit'].map(phase=>input[phase]).filter(Boolean)].filter(ref=>{
  const id=documentId(ref);if(!id||seen.has(id))return false;seen.add(id);return true;
 });
}
export function blendUsers(assets,path){return assets.filter(a=>a.type==='Rig'&&assetFile(a.data?.Processors?.Input?.Blend,assets)===path);}
export const weightError=(_name,value)=>Number.isFinite(value)?'':'请输入完整的有限数值';
export function synchronizeBlend(value,rig,assets){
 const references=rigInputReferences(rig),rows=Array.isArray(value.Rows)?value.Rows:[];
 return {...value,Channels:Object.fromEntries(blendChannels.map(([name])=>[name,{Type:channelType(name)}])),Rows:references.map(ref=>{
  const previous=rows.find(row=>documentId(row.InputAsset)===documentId(ref));
  const asset=assets.find(a=>a.path===assetFile(ref,assets));
  return {InputAsset:asset?assetReference(asset.path,assets):ref,Weights:Object.fromEntries(blendChannels.map(([name])=>[name,Number.isFinite(previous?.Weights?.[name])?previous.Weights[name]:1]))};
 })};
}
export function blendProblems(value,assets,users=[]){
 const errors=[],names=blendChannels.map(([name])=>name),rows=value.Rows;
 if(!Array.isArray(rows))return ['输入混合的 Rows 必须为数组。'];
 if(!value.Channels||names.some(name=>value.Channels[name]?.Type!==channelType(name))||Object.keys(value.Channels).some(name=>!names.includes(name)))errors.push('输入混合必须完整声明公共十三通道及其类型。');
 const seen=new Set();
 for(const row of rows){
  const id=documentId(row?.InputAsset),source=assets.find(a=>a.documentId===id);
  if(!id||seen.has(id)||!['Input','TransitionInput'].includes(source?.type))errors.push('输入混合行必须引用有效且不重复的输入资产。');
  seen.add(id);
  if(!row?.Weights||names.some(name=>!Number.isFinite(row.Weights[name]))||Object.keys(row.Weights).some(name=>!names.includes(name)))errors.push('每个输入混合行必须填写完整的有限通道倍率。');
 }
 for(const rig of users){
  const ids=rigInputReferences(rig).map(documentId);
  if(ids.length!==seen.size||ids.some(id=>!seen.has(id)))errors.push('混合行必须与引用装置挂载的输入资产完全一致。');
 }
 return [...new Set(errors)];
}
