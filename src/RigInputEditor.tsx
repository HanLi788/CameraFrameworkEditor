import {t} from './i18n';
import AssetSlot from './AssetSlot';
import MountSlots from './MountSlots';
import {transitionRole} from './transitionTargets.mjs';
export default function RigInputEditor({value,assets,onNavigate,onField,onTransform}:any){
 const change=(role:string,key?:string)=>onTransform((current:any)=>{const input={...current.Processors.Input};if(key)input[role]=key;else delete input[role];return {...current,Processors:{...current.Processors,Input:input}};});
 const unknown=Object.keys(value).filter(k=>!['Assets','Focus','Unfocus'].includes(k));
 return <div className="rig-input-editor">{unknown.length>0&&<p className="notice" role="alert">{t('存在旧版或未知字段，请在源码中修复：')}{unknown.join(', ')}</p>}
  {Array.isArray(value.Assets)&&value.Assets.every((p:any)=>typeof p==='string')?<MountSlots value={value.Assets} type="Input" title={t('输入资产')} path="Processors.Input.Assets" assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onField(['Processors','Input','Assets'],next,value.Assets)}/>:<p className="notice" role="alert">{t('用户输入挂载必须为路径数组。')}</p>}
  {['Focus','Unfocus'].map(role=><section key={role} className="rig-transition-mount"><h3>{t(role==='Focus'?'聚焦输入':'解除聚焦输入')}</h3><AssetSlot value={value[role]||''} type="TransitionInput" label={'Processors.Input.'+role} assets={assets} choices={assets.filter((a:any)=>a.type==='TransitionInput'&&transitionRole(a.data)===role)} onNavigate={onNavigate} onChange={(key:string)=>change(role,key)} onRemove={value[role]?()=>change(role):undefined}/></section>)}
 </div>;
}
