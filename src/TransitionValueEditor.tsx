import {t} from './i18n';
import Fields from './Fields';
import ValueTable from './ValueTable';
import MetadataInput from './MetadataInput';
import PerformanceBaseSelect from './PerformanceBaseSelect';
import {performanceProblem,transitionValueUsers} from './transitionTargets.mjs';
export default function TransitionValueEditor({value,path,assets,onNavigate,onTransform,onField,catalog}:any){
 const metadata={...value};delete metadata.Channels;delete metadata.PerformanceType;
 const usage=transitionValueUsers(assets,path),present=Object.hasOwn(value,'PerformanceType');
 const type=value.PerformanceType,validObject=type&&typeof type==='object'&&!Array.isArray(type)&&Object.hasOwn(type,'BaseName');
 const changeType=(enabled:boolean)=>onTransform((current:any)=>{const next={...current};if(enabled)next.PerformanceType={BaseName:'PERFORMANCE_PLAYER'};else delete next.PerformanceType;return next;});
 const changeCode=(enabled:boolean)=>onTransform((current:any)=>{const performance={...current.PerformanceType};if(enabled)performance.CodeName='';else delete performance.CodeName;return {...current,PerformanceType:performance};});
 return <div className="transition-value-editor"><Fields value={metadata} assetType="Value" assets={assets} onNavigate={onNavigate} onField={onField}/>
  <section className="performance-editor" aria-label={t('表现类型')}><header><h3>{t('表现类型')}</h3><label><input type="checkbox" aria-label={t('声明表现类型')} checked={present} disabled={present?usage.targets.length>0:usage.defaults.length>0} onChange={e=>changeType(e.target.checked)}/>{t('专用目标值')}</label></header>
   {usage.defaults.length>0&&<p>{t('此资产用作默认解除聚焦目标，不声明表现类型。')}</p>}
   {usage.targets.length>0&&!present&&<p className="range-error" role="alert">{t('专用目标值必须声明表现类型。')}</p>}
   {usage.defaults.length>0&&present&&<p className="range-error" role="alert">{t('默认目标值不能声明表现类型，请移除。')}</p>}
   {present&&!validObject?<div className="notice"><span role="alert">{t('表现类型必须是对象')}</span><button onClick={()=>changeType(true)}>{t('重建表现类型')}</button></div>:present&&<><div className="field"><label>{t('基础表现类别')}</label><PerformanceBaseSelect value={type.BaseName} assets={assets} catalog={catalog} onChange={(text:string)=>onField(['PerformanceType','BaseName'],text,type.BaseName)}/></div><div className="field"><label><input type="checkbox" aria-label={t('指定配置代码')} checked={Object.hasOwn(type,'CodeName')} onChange={e=>changeCode(e.target.checked)}/>{t('配置代码')}</label>{Object.hasOwn(type,'CodeName')?<MetadataInput name="PerformanceType.CodeName" value={type.CodeName} validate={(text:string)=>text.trim()?'':'配置代码必须是非空字符串'} onChange={(text:string)=>onField(['PerformanceType','CodeName'],text,type.CodeName)}/>:<small>{t('未指定代码，仅匹配同样未提供代码的视点。')}</small>}</div>{performanceProblem(type)&&<p className="range-error" role="alert">{t(performanceProblem(type))}</p>}<p>{t('按基础表现类别与配置代码精确匹配；代码保留原始字符串，包括前导零。')}</p></>}
  </section>
  {value.Channels&&typeof value.Channels==='object'&&!Array.isArray(value.Channels)?<ValueTable value={value.Channels} assets={assets} onNavigate={onNavigate} onField={onField} onTransform={onTransform}/>:<p className="notice" role="alert">{t('通道配置无效，请在源码中修复')}</p>}
 </div>;
}
