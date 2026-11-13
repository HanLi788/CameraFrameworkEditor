import {assetFile} from './assetPaths.mjs';
import {t} from './i18n';
import Fields from './Fields';
import AssetSlot from './AssetSlot';
import ValueSlots from './ValueSlots';
import {performanceProblem,transitionInputUsers,transitionRole} from './transitionTargets.mjs';
export default function TransitionInputEditor({value,path,assets,onNavigate,onTransform,onField}:any){
 const users=transitionInputUsers(assets,path),roles=[...new Set<string>(users.map(user=>user.role))];
 const role=roles.length===1?roles[0]:transitionRole(value),unfocus=role==='Unfocus';
 const metadata={...value};delete metadata.ValueAssets;delete metadata.DefaultValueAsset;
 const hasDefault=Object.hasOwn(value,'DefaultValueAsset');
 const changeDefault=(key:string)=>hasDefault?onField(['DefaultValueAsset'],key,value.DefaultValueAsset):onTransform((current:any)=>({...current,DefaultValueAsset:key}));
 const targets=value.ValueAssets;
 return <div className="transition-input-editor"><div className="transition-role"><strong>{t(unfocus?'解除聚焦':'聚焦')} · {role}</strong><small>{t('时长与曲线来自本次选中的目标值资产。')}</small></div><Fields value={metadata} assetType="TransitionInput" assets={assets} onNavigate={onNavigate} onField={onField}/>
  {roles.length>1&&<p role="alert" className="notice">{t('同一输入不能同时用于 Focus 和 Unfocus。')}</p>}
  {!unfocus&&hasDefault&&<div className="notice"><span role="alert">{t('聚焦输入不能挂载默认目标值。')}</span><button onClick={()=>onTransform((current:any)=>{const next={...current};delete next.DefaultValueAsset;return next;})}>{t('移除默认目标值')}</button></div>}
  {unfocus&&<section className="transition-default"><h3>{t('默认解除聚焦目标')}</h3><AssetSlot value={value.DefaultValueAsset||''} type="Value" label="DefaultValueAsset" assets={assets} choices={assets.filter((a:any)=>a.type==='Value'&&a.data?.PerformanceType===undefined)} onNavigate={onNavigate} onChange={changeDefault}/>{(!hasDefault||!assets.some((a:any)=>a.path===assetFile(value.DefaultValueAsset)&&a.type==='Value'&&a.data?.PerformanceType===undefined))&&<p role="alert" className="range-error">{t('解除聚焦必须挂载不声明表现类型的默认目标值。')}</p>}</section>}
  {Array.isArray(targets)&&targets.every(p=>typeof p==='string')?<ValueSlots value={targets} assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onField(['ValueAssets'],next,targets)} minItems={unfocus?0:1} title={t('专用目标值')} />:<p role="alert" className="notice">{t('目标值挂载必须为路径数组，请在源码中修复。')}</p>}
  {Array.isArray(targets)&&targets.some(file=>{const asset=assets.find((a:any)=>a.path===assetFile(file));return !asset||asset.type!=='Value'||performanceProblem(asset.data?.PerformanceType);})&&<p className="notice" role="alert">{t('专用目标值必须声明有效的表现类型。')}</p>}
  {!unfocus&&Array.isArray(targets)&&!targets.length&&<p role="alert" className="notice">{t('聚焦输入至少挂载一个专用目标值。')}</p>}
 </div>;
}
