import {t} from './i18n';
import {assetFile} from './assetPaths.mjs';
import AssetSlot from './AssetSlot';
import MountSlots from './MountSlots';
import {isSequenceInput} from './transitionTargets.mjs';
export default function RigInputEditor({value,assets,onNavigate,onField,onTransform}:any){
 const change=(role:string,ref?:any)=>onTransform((current:any)=>{const input={...current.Processors.Input};if(ref)input[role]=ref;else delete input[role];return {...current,Processors:{...current.Processors,Input:input}};});
 const unknown=Object.keys(value).filter(k=>!['Assets','Enter','Change','Exit'].includes(k));
 const sequence=['Enter','Exit'].some(role=>isSequenceInput(assets.find((a:any)=>a.path===assetFile(value[role],assets))?.data,assets));
 const labels:Record<string,string>={Enter:'进入输入',Change:'视点变化输入',Exit:'退出输入'};
 return <div className="rig-input-editor">{unknown.length>0&&<p className="notice" role="alert">{t('存在旧版或未知字段，请在源码中修复：')}{unknown.join(', ')}</p>}
  {sequence?<p>{t('序列装置按 SequenceId 选择进入和退出目标，不使用用户输入或视点变化输入。')}</p>:Array.isArray(value.Assets)?<MountSlots value={value.Assets} type="Input" title={t('输入资产')} path="Processors.Input.Assets" assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onField(['Processors','Input','Assets'],next,value.Assets)}/>:<p className="notice" role="alert">{t('用户输入挂载必须为文档引用数组。')}</p>}
  {(sequence?['Enter','Exit']:['Enter','Change','Exit']).map(role=><section key={role} className="rig-transition-mount"><h3>{t(labels[role])}</h3><AssetSlot compact value={value[role]} type="TransitionInput" label={'Processors.Input.'+role} assets={assets} choices={assets.filter((a:any)=>a.type==='TransitionInput'&&isSequenceInput(a.data,assets)===sequence&&(sequence?!Object.hasOwn(a.data||{},'DefaultValueAsset'):Object.hasOwn(a.data||{},'DefaultValueAsset')===(role==='Exit'))&&!['Enter','Change','Exit'].some(other=>other!==role&&assetFile(value[other],assets)===a.path))} onNavigate={onNavigate} onChange={(ref:any)=>change(role,ref)} onRemove={value[role]?()=>change(role):undefined}/></section>)}
 </div>;
}
