import {t} from './i18n';
import {assetFile,documentId} from './assetPaths.mjs';
import AssetSlot from './AssetSlot';
import MountSlots from './MountSlots';
import MountTable from './MountTable';
import {isSequenceInput} from './transitionTargets.mjs';

export default function RigInputEditor({value,assets,onNavigate,onField,onTransform}:any){
 const change=(role:string,ref?:any)=>onTransform((current:any)=>{const input={...current.Processors.Input};if(ref)input[role]=ref;else delete input[role];return {...current,Processors:{...current.Processors,Input:input}};});
 const unknown=Object.keys(value).filter(key=>!['Assets','Enter','Change','Exit','Blend'].includes(key));
 const sequence=['Enter','Exit'].some(role=>isSequenceInput(assets.find((a:any)=>a.path===assetFile(value[role],assets))?.data,assets)||documentId(value[role])?.startsWith('Camera/RoamCamera/'));
 const labels:any={Enter:'进入',Change:'视点变化',Exit:'退出'};
 return <div className="rig-input-editor mount-stack">
  {unknown.length>0&&<p role="alert" className="range-error">{t('存在旧版或未知字段：')}{unknown.join(', ')}</p>}
  {Array.isArray(value.Assets)?<MountSlots allowAdd={!sequence} value={value.Assets} type="Input" title="真实用户输入源" path="Processors.Input.Assets" assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onField(['Processors','Input','Assets'],next,value.Assets)}/>:<p role="alert">{t('用户输入挂载必须为文档引用数组。')}</p>}
  <MountTable title="虚拟过渡输入源" columns={['阶段','资产']} kind="transitions">{(sequence?['Enter','Exit']:['Enter','Change','Exit']).map(role=><tr key={role}><td>{t(labels[role])}</td><td><AssetSlot compact value={value[role]} type="TransitionInput" label={'Processors.Input.'+role} assets={assets} choices={assets.filter((a:any)=>a.type==='TransitionInput'&&isSequenceInput(a.data,assets)===sequence&&!Object.hasOwn(a.data||{},'DefaultValueAsset')&&!['Enter','Change','Exit'].some(other=>other!==role&&assetFile(value[other],assets)===a.path))} onNavigate={onNavigate} onChange={(ref:any)=>change(role,ref)} onRemove={value[role]?()=>change(role):undefined}/></td></tr>)}</MountTable>
  <MountTable title="输入源混合" columns={['用途','资产']} kind="blend"><tr><td>{t('输入混合')}</td><td><AssetSlot compact value={value.Blend} type="InputBlend" label="Processors.Input.Blend" assets={assets} onNavigate={onNavigate} onChange={(ref:any)=>change('Blend',ref)}/>{!value.Blend&&<small role="alert">{t('必须挂载输入混合资产。')}</small>}</td></tr></MountTable>
 </div>;
}
