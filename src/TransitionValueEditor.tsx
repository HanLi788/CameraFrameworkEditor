import CheckboxInput from './CheckboxInput';
import NumericInput from './NumericInput';
import {t} from './i18n';
import Fields from './Fields';
import ValueTable from './ValueTable';
import MetadataInput from './MetadataInput';
import PerformanceBaseSelect from './PerformanceBaseSelect';
import {performanceProblem,isSequenceValue} from './transitionTargets.mjs';
export default function TransitionValueEditor({value,path,assets,onNavigate,onTransform,onField,catalog}:any){
 const metadata={...value};delete metadata.Channels;delete metadata.PerformanceType;delete metadata.SequenceId;delete metadata.bEnabled;
 const sequence=isSequenceValue(value);
 const present=Object.hasOwn(value,'PerformanceType');
 const type=value.PerformanceType,validObject=type&&typeof type==='object'&&!Array.isArray(type)&&Object.hasOwn(type,'BaseName');
 const changeType=(enabled:boolean)=>onTransform((current:any)=>{const next={...current};if(enabled)next.PerformanceType={BaseName:'PERFORMANCE_PLAYER'};else delete next.PerformanceType;return next;});
 // Commit the identity through onField without re-entering the text draft flush barrier.
 const changeCode=(text:string)=>{const next={...type};if(text==='None')delete next.CodeName;else next.CodeName=text;return onField(['PerformanceType'],next,type);};
 return <div className="transition-value-editor"><div className="transition-config-bar"><section className="value-enabled" data-field="bEnabled"><label><span>{t('启用过渡')}</span><CheckboxInput aria-label="bEnabled" value={value.bEnabled} disabled={typeof value.bEnabled!=='boolean'} onValueChange={(next:boolean)=>onField(['bEnabled'],next,value.bEnabled)}/></label>{typeof value.bEnabled!=='boolean'&&<div className="notice"><span role="alert">{t('bEnabled 必填且必须为布尔值。')}</span><button onClick={()=>onTransform((current:any)=>({...current,bEnabled:true}))}>{t('设为启用')}</button></div>}</section><div className="transition-metadata"><Fields value={metadata} assetType="Value" assets={assets} onNavigate={onNavigate} onField={onField}/></div>
  {sequence?<section className="sequence-editor" aria-label={t('序列目标')}>
   <h3>{t('序列编号')}</h3><NumericInput single name="SequenceId" value={{Value:value.SequenceId}} validate={(_name:string,n:number)=>Number.isSafeInteger(n)&&n>0?'':'序列编号必须为正整数'} onChange={(next:any)=>Object.hasOwn(value,'SequenceId')?onField(['SequenceId'],next.Value,value.SequenceId):onTransform((current:any)=>({...current,SequenceId:next.Value}))}/>
   {present&&<div className="notice"><span role="alert">{t('序列目标不能声明表现类型。')}</span><button onClick={()=>changeType(false)}>{t('移除表现类型')}</button></div>}
  </section>:<section className="performance-editor" aria-label={t('表现类型')}>
   {!present&&<div className="notice"><span className="range-error" role="alert">{t('目标值必须声明表现类型。')}</span><button onClick={()=>changeType(true)}>{t('重建表现类型')}</button></div>}
   {present&&!validObject?<div className="notice"><span role="alert">{t('表现类型必须是对象')}</span><button onClick={()=>changeType(true)}>{t('重建表现类型')}</button></div>:present&&<>
    <div className="performance-identity-row">
     <div className="performance-base-field"><span>{t('基础表现类型')}</span><PerformanceBaseSelect value={type.BaseName} assets={assets} catalog={catalog} onChange={(text:string)=>onField(['PerformanceType','BaseName'],text,type.BaseName)}/></div>
     <label className="performance-code-field"><span>{t('代号')}</span><MetadataInput name="PerformanceType.CodeName" value={Object.hasOwn(type,'CodeName')?type.CodeName:'None'} validate={(text:string)=>text.trim()?'':'代号必须是非空字符串，无代号请填写 None'} onChange={changeCode}/></label>
    </div>
    {performanceProblem(type)&&<p className="range-error" role="alert">{t(performanceProblem(type))}</p>}
   </>}
  </section>}</div>
  {value.Channels&&typeof value.Channels==='object'&&!Array.isArray(value.Channels)?<ValueTable sequence={sequence} value={value.Channels} assets={assets} onNavigate={onNavigate} onField={onField} onTransform={onTransform}/>:<p className="notice" role="alert">{t('通道配置无效，请修复资产后重新载入')}</p>}
 </div>;
}
