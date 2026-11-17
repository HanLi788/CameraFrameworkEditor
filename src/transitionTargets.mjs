import {assetFile} from './assetPaths.mjs';
export function performanceProblem(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return '表现类型必须是对象';
 if(Object.keys(value).some(k=>!['BaseName','CodeName'].includes(k)))return '表现类型存在未知字段';
 if(typeof value.BaseName!=='string'||!/^PERFORMANCE_[A-Z0-9_]+$/.test(value.BaseName))return '基础表现类别格式无效';
 if(Object.hasOwn(value,'CodeName')&&(typeof value.CodeName!=='string'||!value.CodeName.trim()))return '配置代码必须是非空字符串';
 return '';
}
export function performanceKey(value){return performanceProblem(value)?null:JSON.stringify([value.BaseName,value.CodeName??null]);}
export function performanceLabel(value){return performanceProblem(value)?'':value.BaseName+(value.CodeName===undefined?'':' · '+value.CodeName);}
export function transitionRole(value){return Object.hasOwn(value||{},'DefaultValueAsset')||/_Exit$/.test(value?.Name||'')?'Exit':/_Change$/.test(value?.Name||'')?'Change':'Enter';}
export function isSequenceValue(value){return value&&typeof value==='object'&&(Object.hasOwn(value,'SequenceId')||Object.hasOwn(value.Channels||{},'LocationX'));}
export function isSequenceInput(value,assets){return Array.isArray(value?.ValueAssets)&&value.ValueAssets.some(ref=>isSequenceValue(assets.find(a=>a.path===assetFile(ref,assets))?.data));}
export function transitionInputUsers(assets,path){
 return assets.filter(a=>a.type==='Rig').flatMap(a=>['Enter','Change','Exit'].filter(role=>assetFile(a.data?.Processors?.Input?.[role],assets)===path).map(role=>({path:a.path,role,sequence:a.documentId?.startsWith('Camera/RoamCamera/')||isSequenceInput(assets.find(item=>item.path===path)?.data,assets)})));
}
export function transitionValueUsers(assets,path){
 const defaults=[],targets=[];
 for(const a of assets.filter(a=>a.type==='TransitionInput')){
  if(assetFile(a.data?.DefaultValueAsset,assets)===path)defaults.push(a.path);
  if(Array.isArray(a.data?.ValueAssets)&&a.data.ValueAssets.some(p=>assetFile(p,assets)===path))targets.push(a.path);
 }
 return {defaults,targets};
}
export function targetChoiceAllowed(candidate,value,assets,replacing=-1,sequence=false){
 const selectionKey=data=>sequence?(Number.isSafeInteger(data?.SequenceId)&&data.SequenceId>0&&data.PerformanceType===undefined?String(data.SequenceId):null):isSequenceValue(data)?null:performanceKey(data?.PerformanceType);
 const key=selectionKey(candidate.data);
 if(candidate.type!=='Value'||key===null)return false;
 return !value.some((file,i)=>i!==replacing&&selectionKey(assets.find(a=>a.path===assetFile(file,assets))?.data)===key);
}
