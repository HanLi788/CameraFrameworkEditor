import {assetFile,documentId} from './assetPaths.mjs';
import {t} from './i18n';
import Fields from './Fields';
import AssetSlot from './AssetSlot';
import ValueSlots from './ValueSlots';
import {performanceProblem,isSequenceValue,isSequenceInput,transitionInputUsers,transitionRole} from './transitionTargets.mjs';
export default function TransitionInputEditor({value,path,assets,onNavigate,onTransform,onField}:any){
 const users=transitionInputUsers(assets,path),roles=[...new Set<string>(users.map(user=>user.role))];
 const sequence=users.some(user=>user.sequence)||isSequenceInput(value,assets)||assets.find((a:any)=>a.path===path)?.documentId?.startsWith('Camera/RoamCamera/');
 const role=roles.length?roles.join(' / '):transitionRole(value),exit=roles.length?roles.includes('Exit'):transitionRole(value)==='Exit';
 const defaults=exit&&!sequence,hasDefault=Object.hasOwn(value,'DefaultValueAsset');
 const metadata={...value};delete metadata.ValueAssets;delete metadata.DefaultValueAsset;
 const changeDefault=(ref:any)=>hasDefault?onField(['DefaultValueAsset'],ref,value.DefaultValueAsset):onTransform((current:any)=>({...current,DefaultValueAsset:ref}));
 const targets=value.ValueAssets;
 const targetProblem=Array.isArray(targets)&&targets.some(ref=>{const asset=assets.find((a:any)=>a.path===assetFile(ref,assets));return !asset||asset.type!=='Value'||(sequence?!(Number.isSafeInteger(asset.data?.SequenceId)&&asset.data.SequenceId>0)||asset.data?.PerformanceType!==undefined:isSequenceValue(asset.data)||performanceProblem(asset.data?.PerformanceType));});
 return <div className="transition-input-editor"><div className="transition-role"><strong>{t(sequence?'序列过渡':'视点过渡')} · {role}</strong><small>{t('时长与曲线来自本次选中的目标值资产。')}</small></div><Fields value={metadata} assetType="TransitionInput" assets={assets} onNavigate={onNavigate} onField={onField}/>
  {!sequence&&roles.includes('Exit')&&roles.some(role=>role!=='Exit')&&<p role="alert" className="notice">{t('退出输入不能同时用于进入或视点变化。')}</p>}
  {!defaults&&hasDefault&&<div className="notice"><span role="alert">{t(sequence?'序列过渡不能挂载默认目标值。':'进入和视点变化输入不能挂载默认目标值。')}</span><button onClick={()=>onTransform((current:any)=>{const next={...current};delete next.DefaultValueAsset;return next;})}>{t('移除默认目标值')}</button></div>}
  {defaults&&<section className="transition-default"><h3>{t('默认退出目标')}</h3><AssetSlot compact value={value.DefaultValueAsset} type="Value" label="DefaultValueAsset" assets={assets} choices={assets.filter((a:any)=>a.type==='Value'&&a.data?.PerformanceType===undefined&&!isSequenceValue(a.data))} onNavigate={onNavigate} onChange={changeDefault}/>{(!hasDefault||!assets.some((a:any)=>a.path===assetFile(value.DefaultValueAsset,assets)&&a.type==='Value'&&a.data?.PerformanceType===undefined&&!isSequenceValue(a.data)))&&<p role="alert" className="range-error">{t('退出输入必须挂载不声明表现类型的默认目标值。')}</p>}</section>}
  {Array.isArray(targets)&&targets.every(ref=>typeof documentId(ref)==='string')?<ValueSlots sequence={sequence} value={targets} assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onField(['ValueAssets'],next,targets)} minItems={defaults?0:1} title={t(sequence?'序列目标值':'专用目标值')} />:<p role="alert" className="notice">{t('目标值挂载必须为文档引用数组，请在源码中修复。')}</p>}
  {targetProblem&&<p className="notice" role="alert">{t(sequence?'序列目标必须声明正整数 SequenceId，不声明表现类型。':'专用目标值必须声明有效的表现类型。')}</p>}
  {!defaults&&Array.isArray(targets)&&!targets.length&&<p role="alert" className="notice">{t('过渡输入至少挂载一个目标值。')}</p>}
 </div>;
}
