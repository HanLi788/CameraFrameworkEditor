import {useEffect,useRef,useState} from 'react';
import {t} from './i18n';
import Icon,{IconButton} from './Icon';
import HelpTip from './HelpTip';
import EffectChannelTable from './EffectChannelTable';
import {EffectSetField} from './EffectFields';
import {effectOutputTemplate,parseEffectSet} from './effectSets.mjs';
import {rangeChannels} from './rangeChannels.mjs';
const booleanDomain='{0} or {1}';
const defaultParam=(p:any)=>p.Default??p.Enum?.[0]??(p.Type==='boolean'?false:p.Type==='number'?0:'');
function isBooleanDomain(value:any){try{const s=parseEffectSet(value);return s.parts.length===2&&s.parts[0].min===0&&s.parts[0].max===0&&s.parts[1].min===1&&s.parts[1].max===1;}catch{return false;}}
function ParamsDialog({source,spec,onChange,onClose}:any){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
 const params=Array.isArray(source.Params)?source.Params:[];
 const change=(index:number,value:any)=>{const next=params.slice();for(let i=0;i<=index;i++)if(next[i]===undefined)next[i]=defaultParam(spec.Params[i]);next[index]=value;onChange(next);};
 return <dialog className="effect-params-dialog" ref={ref} aria-label={t('调用参数')} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onKeyDown={e=>{if(e.key==='Escape')e.stopPropagation();}}><header><b>{source.Object}.{source.Interface}</b><IconButton icon="close" label={t('关闭参数')} onClick={onClose}/></header>
  <div className="effect-param-list">{spec.Params.map((p:any,i:number)=>{const present=params[i]!==undefined,value=present?params[i]:defaultParam(p),invalid=(!present&&!p.Optional)||present&&(typeof value!==p.Type||p.Enum&&!p.Enum.includes(value)||p.Type==='number'&&(!Number.isFinite(value)||p.Min!==undefined&&value<p.Min||p.Max!==undefined&&value>p.Max));
   return <label key={p.Name} className="effect-param"><span>{p.Name}<small>{p.Type}</small></span>{p.Optional&&<input type="checkbox" title={t('传入此参数；取消时使用接口默认值')} aria-label={p.Name+'.Provided'} checked={present} onChange={e=>e.target.checked?change(i,defaultParam(p)):onChange(params.slice(0,i))}/>}
    {p.Enum?<select aria-label={'Source.Params.'+i} aria-invalid={!!invalid} disabled={!present&&p.Optional} value={String(value)} onChange={e=>change(i,p.Enum.find((v:any)=>String(v)===e.target.value))}>{invalid&&<option value={String(value)}>{String(value)}</option>}{p.Enum.map((v:any)=><option key={String(v)} value={String(v)}>{String(v)}</option>)}</select>:p.Type==='boolean'?<input aria-label={'Source.Params.'+i} aria-invalid={!!invalid} disabled={!present&&p.Optional} type="checkbox" checked={value===true} onChange={e=>change(i,e.target.checked)}/>:<input aria-label={'Source.Params.'+i} aria-invalid={!!invalid} disabled={!present&&p.Optional} type={p.Type==='number'?'number':'text'} step="any" min={p.Min} max={p.Max} value={value} onChange={e=>{const v=p.Type==='number'?Number(e.target.value):e.target.value;if(p.Type!=='number'||e.target.value.trim()&&Number.isFinite(v))change(i,v);}}/>}
   </label>;
  })}{params.length>spec.Params.length&&<p role="alert">{t('参数数量与注册表不符')}</p>}</div></dialog>;
}
export default function EffectTable({value,catalog,onTransform,assets,onNavigate,presets,setPresets,path,propertiesOnly=false,post=false,numericPost=false}:any){
 const [paramsOpen,setParamsOpen]=useState(false),[refreshError,setRefreshError]=useState('');
 const objects=catalog?.objects||[],source=value.Source||{},object=objects.find((o:any)=>o.name===source.Object),interfaces=object?.interfaces||[],entry=interfaces.find((i:any)=>i.name===source.Interface),spec=entry?.definition,boolean=spec?.ReturnType==='boolean';
 const paramsValid=spec&&Array.isArray(source.Params)&&source.Params.length<=spec.Params.length&&spec.Params.every((p:any,i:number)=>{const v=source.Params[i];return v===undefined?p.Optional===true:typeof v===p.Type&&(!p.Enum||p.Enum.includes(v))&&(p.Type!=='number'||Number.isFinite(v)&&(p.Min===undefined||v>=p.Min)&&(p.Max===undefined||v<=p.Max));});
 const outputs=value.Outputs&&typeof value.Outputs==='object'&&!Array.isArray(value.Outputs)?value.Outputs:null;
 const unknown=Object.keys(value).filter(k=>!['SchemaVersion','Name','Description','Source','Domain','Outputs',...(post?['Reachability','SmoothTime']:[])].includes(k));
 const sourceUnknown=Object.keys(source).filter(k=>!['Object','Interface','Params'].includes(k));
 const field=(key:string,next:any)=>onTransform((current:any)=>({...current,[key]:next}));
 const selectSource=(objectName:string,interfaceName:string)=>{const item=objects.find((o:any)=>o.name===objectName)?.interfaces.find((i:any)=>i.name===interfaceName);onTransform((current:any)=>({...current,Source:{Object:objectName,Interface:interfaceName,Params:item?.definition.Params.map(defaultParam)||[]},Domain:item?.definition.ReturnType==='boolean'?booleanDomain:current.Domain}));setParamsOpen(false);};
 const basicNames=rangeChannels.map(([name])=>name);
 const template=(name:string)=>({...effectOutputTemplate(value.Domain,assets),Type:/^Rotation/.test(name)?'Angle':'Scalar'});
 const preset=(name:string)=>Object.hasOwn(presets,name)?presets[name]:template(name);
 const output=(name:string,update:any)=>{
  if(outputs&&Object.hasOwn(outputs,name))return onTransform((current:any)=>Object.hasOwn(current.Outputs,name)?{...current,Outputs:{...current.Outputs,[name]:update(current.Outputs[name])}}:current);
  setPresets((previous:any)=>({...previous,[name]:update(Object.hasOwn(previous,name)?previous[name]:template(name))}));
 };
 const writeOutput=(name:string,enabled:boolean)=>{
  const next=structuredClone(preset(name));
  onTransform((current:any)=>{const result={...current.Outputs};if(enabled){if(!Object.hasOwn(result,name))result[name]=next;}else{if(Object.hasOwn(result,name)){const previousValue=structuredClone(result[name]);setPresets((previous:any)=>({...previous,[name]:previousValue}));}delete result[name];}return {...current,Outputs:result};});
 };
 const heading=(label:string,hint?:string)=><span className="field-label">{t(label)}{hint&&<HelpTip label={t(label)+' '+t('说明')}>{t(hint)}</HelpTip>}</span>;
 const label=(name:string)=>t(rangeChannels.find(([n])=>n===name)?.[1]||name);
 const table=(names:string[],title:string)=><EffectChannelTable title={t(title)} domain={value.Domain} assets={assets} onNavigate={onNavigate} onOutput={output} onWrite={writeOutput} rows={names.map(name=>{const channel=rangeChannels.find(([n])=>n===name),written=!!outputs&&Object.hasOwn(outputs,name);return {name,label:label(name),icon:channel?'channel-'+channel[2]:'effect',written,value:written?outputs[name]:preset(name),unknown:catalog?.channels&&!catalog.channels.includes(name)};})}/>;
 return <div className="effect-editor">
  <section className="effect-card" aria-label={t(post?'后处理属性':'效果属性')}>
  <header className="effect-table-heading"><h3><Icon name="sliders" size={18}/>{t(post?'后处理属性':'效果属性')}</h3><IconButton icon="reset" label={t('刷新效果接口')} onClick={()=>{setRefreshError('');window.cameraEditor.snapshot().catch(e=>setRefreshError(String(e)));}}/></header>
  {(catalog?.issues||[]).map((i:any,n:number)=><p key={n} className="range-error" role="alert">{i.message}</p>)}{refreshError&&<p role="alert">{refreshError}</p>}
  {value.SchemaVersion!==1&&<p className="range-error" role="alert">{t('效果资产版本必须为 1')}</p>}
  {(unknown.length>0||sourceUnknown.length>0)&&<p className="range-error" role="alert">{t('存在旧版或未知字段，请在源码中修复：')}{[...unknown,...sourceUnknown.map(k=>'Source.'+k)].join(', ')}</p>}
  {post&&!numericPost&&<div className="post-mode-fields"><label>{t('混合模式')}<select aria-label="Mode" value={value.Mode} onChange={e=>field('Mode',e.target.value)}><option>Target</option><option>Add</option></select></label><label>{t('优先级')}<input type="number" step="any" aria-label="Priority" disabled={value.Mode==='Add'} value={value.Priority??0} onChange={e=>{if(e.target.value.trim()&&Number.isFinite(Number(e.target.value)))field('Priority',Number(e.target.value));}}/></label></div>}
  <div className="range-table-scroll"><table className="range-table effect-properties" aria-label={t(post?'后处理属性':'效果属性')}><thead><tr><th>{t('上下文对象')}</th><th>{t('接口名称')}</th><th>{t('调用参数')}</th><th>{heading('定义域','支持区间、单点和并集，例如 [0,300] or [600,999) or {500}。域外当帧不贡献，所有片段共享上下界归一化；false / true 按 0 / 1 处理。')}</th></tr></thead><tbody><tr>
   <td><select aria-label="Source.Object" aria-invalid={!object} value={source.Object??''} onChange={e=>{const name=e.target.value,methods=objects.find((o:any)=>o.name===name)?.interfaces||[];selectSource(name,methods.some((i:any)=>i.name===source.Interface)?source.Interface:methods[0]?.name||'');}}>{!object&&<option value={source.Object??''}>{source.Object||'—'}</option>}{objects.map((o:any)=><option key={o.name} value={o.name}>{o.name}</option>)}</select></td>
   <td><select aria-label="Source.Interface" aria-invalid={!entry} title={spec?.ReturnType} value={source.Interface??''} onChange={e=>selectSource(source.Object,e.target.value)}>{!entry&&<option value={source.Interface??''}>{source.Interface||'—'}</option>}{interfaces.map((i:any)=><option key={i.name} value={i.name}>{i.name}</option>)}</select></td>
   <td><button disabled={!spec} onClick={()=>setParamsOpen(true)}>{t('参数')} ({Array.isArray(source.Params)?source.Params.length:0})</button></td>
   <td><EffectSetField path="Domain" value={value.Domain} readOnly={boolean} displayValue={boolean?'{0} ∪ {1}':undefined} onChange={(next:any)=>field('Domain',next)}/></td>
  </tr></tbody></table></div>
  {!entry&&<p className="range-error" role="alert">{t('接口未注册：')}{source.Object}.{source.Interface}</p>}
  {spec&&!paramsValid&&<p className="range-error" role="alert">{t('参数与接口声明不符')}</p>}
  {boolean&&!isBooleanDomain(value.Domain)&&<p className="range-error" role="alert">{t('布尔接口定义域必须为 {0} or {1}，请在源码中修复')}</p>}
  </section>
  {!propertiesOnly&&<section className="effect-card" aria-label={t('基本通道')}>
  <header className="effect-table-heading"><h3><Icon name="outputs" size={18}/>{t('基本通道')}</h3></header>
  {outputs?<>{Object.keys(outputs).length===0&&<p className="range-error" role="alert">{t('至少勾选一个写入通道')}</p>}{table(basicNames,'基本通道')}
   </>:<p role="alert">{t('通道配置无效，请在源码中修复')}</p>}
   {Object.keys(outputs||{}).some(name=>!basicNames.includes(name))&&<p className="range-error" role="alert">{t('后处理通道须迁移到后处理资产')}</p>}
  </section>}
  {paramsOpen&&spec&&<ParamsDialog source={source} spec={spec} onClose={()=>setParamsOpen(false)} onChange={(Params:any)=>onTransform((current:any)=>({...current,Source:{...current.Source,Params}}))}/>}
 </div>;
}
