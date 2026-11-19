import {assetFile,documentId} from './assetPaths.mjs';
import {t} from './i18n';
import Fields from './Fields';
import ValueSlots from './ValueSlots';
import {performanceProblem,isSequenceValue,isSequenceInput,transitionInputUsers,transitionRole} from './transitionTargets.mjs';
export default function TransitionInputEditor({value,path,assets,onNavigate,onTransform,onField}:any){
 const users=transitionInputUsers(assets,path),roles=[...new Set<string>(users.map(user=>user.role))];
 const sequence=users.some(user=>user.sequence)||isSequenceInput(value,assets)||assets.find((a:any)=>a.path===path)?.documentId?.startsWith('Camera/RoamCamera/');
 const role=roles.length?roles.join(' / '):transitionRole(value),hasDefault=Object.hasOwn(value,'DefaultValueAsset');
 const metadata={...value};delete metadata.ValueAssets;delete metadata.DefaultValueAsset;
 const targets=value.ValueAssets;
 const targetProblem=Array.isArray(targets)&&targets.some(ref=>{const asset=assets.find((a:any)=>a.path===assetFile(ref,assets));return !asset||asset.type!=='Value'||(sequence?!(Number.isSafeInteger(asset.data?.SequenceId)&&asset.data.SequenceId>0)||asset.data?.PerformanceType!==undefined:isSequenceValue(asset.data)||performanceProblem(asset.data?.PerformanceType));});
 return <div className="transition-input-editor"><div className="transition-role"><strong>{t(sequence?'序列过渡':'视点过渡')} · {role}</strong></div><Fields value={metadata} assetType="TransitionInput" assets={assets} onNavigate={onNavigate} onField={onField}/>
  {hasDefault&&<div className="notice"><span role="alert">{t('默认目标值协议已移除，请为退出输入挂载精确目标值。')}</span><button onClick={()=>onTransform((current:any)=>{const next={...current};delete next.DefaultValueAsset;return next;})}>{t('移除默认目标值')}</button></div>}
  {Array.isArray(targets)&&targets.every(ref=>typeof documentId(ref)==='string')?<ValueSlots sequence={sequence} value={targets} assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onField(['ValueAssets'],next,targets)} minItems={1} title={t(sequence?'序列目标值':'目标值资产')} />:<p role="alert" className="notice">{t('目标值挂载必须为文档引用数组，请修复资产后重新载入。')}</p>}
  {targetProblem&&<p className="notice" role="alert">{t(sequence?'序列目标必须声明正整数 SequenceId，不声明表现类型。':'专用目标值必须声明有效的表现类型。')}</p>}
  {Array.isArray(targets)&&!targets.length&&<p role="alert" className="notice">{t('过渡输入至少挂载一个目标值。')}</p>}
 </div>;
}
