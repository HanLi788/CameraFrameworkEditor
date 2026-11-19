import FixedTable,{tableColumns} from './FixedTable';
import {VectorRangeInput,RatioRangeInput} from './StructuredNumbers';
import {useReferenceCatalog} from './ReferenceCatalog';
import SelectInput from './SelectInput';
import NumericInput from './NumericInput';
import {t} from './i18n';
import Icon from './Icon';
import {rangeChannels,referencesFor} from './rangeChannels.mjs';


function ReferenceSelect({name,value,onChange}:any){const catalog=useReferenceCatalog(),options=referencesFor(name,catalog);return options.length===1&&options[0]===value?<span>{value}</span>:<SelectInput aria-label={name+'.Reference'} value={value} onValueChange={onChange}>{!options.includes(value)&&<option value={value}>{value}</option>}{options.map((option:string)=><option key={option} value={option}>{option}</option>)}</SelectInput>;}
export default function RangeTable({value,onField}:any){
  const extra=Object.keys(value).filter(key=>!rangeChannels.some(([name])=>name===key));
  return <div className="range-table-scroll">{extra.length>0&&<p className="range-error" role="alert">{t('存在旧版或未知字段：')}{extra.join(', ')}</p>}<FixedTable columns={tableColumns.range} className="range-table"><thead><tr>{['通道','范围','参考系','启用'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rangeChannels.map(([name,label,icon])=>{
    const channel=value[name],unknown=channel&&Object.keys(channel).filter(k=>!['Type','Min','Max','Reference','bEnabled'].includes(k));
    if(!channel||typeof channel!=='object'||Array.isArray(channel))return <tr key={name}><th>{t(label)}</th><td colSpan={3} role="alert" className="range-error">{t('通道配置无效，请修复资产后重新载入')}</td></tr>;
    return <tr key={name} data-range-channel={name} className={channel.bEnabled?'':'range-disabled'}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={18}/><span>{t(label)}</span></div>{unknown.length>0&&<small className="range-error" role="alert">{unknown.join(', ')}</small>}</th>
      <td>{channel.Type==='Vector'?<VectorRangeInput name={name} value={channel} onChange={(next:any)=>onField(['Channels',name],next,channel)}/>:name==='AspectRatio'?<RatioRangeInput name={name} value={channel} onChange={(next:any)=>onField(['Channels',name],next,channel)}/>:<NumericInput name={name} value={channel} onChange={(next:any)=>onField(['Channels',name],next,channel)}/>}</td><td><ReferenceSelect name={name} value={channel.Reference} onChange={(next:string)=>onField(['Channels',name,'Reference'],next,channel.Reference)}/></td><td><input type="checkbox" aria-label={name+'.bEnabled'} checked={channel.bEnabled===true} onChange={e=>onField(['Channels',name,'bEnabled'],e.target.checked,channel.bEnabled)}/></td></tr>;
  })}</tbody></FixedTable></div>;
}
