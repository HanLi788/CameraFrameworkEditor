import FixedTable,{tableColumns} from './FixedTable';
import {VectorInput,RatioInput} from './StructuredNumbers';
import ValueReferenceInput from './ValueReferenceInput';
import {assetFile} from './assetPaths.mjs';
import {t} from './i18n';
import Icon from './Icon';
import HelpTip from './HelpTip';
import NumericInput from './NumericInput';
import AssetSlot from './AssetSlot';
import SelectInput from './SelectInput';
import {channelsFor,rangeError} from './rangeChannels.mjs';
import {valueLabels,valueTypes,valueError,changeReference} from './valueChannels.mjs';

function Select({label,value,options,onChange,raw=false}:any){return <SelectInput aria-label={label} title={String(value)} value={value??''} aria-invalid={!options.includes(value)} onValueChange={onChange}>{!options.includes(value)&&<option value={value??''}>{String(value??'—')}</option>}{options.map((key:string)=><option key={key} value={key}>{raw?key:t(valueLabels[key]||key)}</option>)}</SelectInput>;}
export default function ValueTable({value,onField,onTransform,assets,onNavigate,sequence=false}:any){
  const scalar=(name:string,keys:string[],v:any,validate:any=(_name:string,n:number)=>rangeError('',n,n))=><NumericInput single name={[name,...keys].join('.')} value={{Value:v}} validate={validate} onChange={(next:any)=>onField(['Channels',name,...keys],next.Value,v)}/>;
  const channels=channelsFor(value);
  const extra=Object.keys(value).filter(key=>!channels.some(([name])=>name===key));
  return <div className="range-table-scroll">{extra.length>0&&<p role="alert" className="range-error">{t('存在旧版或未知字段：')}{extra.join(', ')}</p>}
    <FixedTable columns={tableColumns.value} className="range-table value-table"><thead><tr>{['通道','值类型','目标值','参考系','采样方式','曲线','启用'].map(label=><th key={label}><span className="field-label">{t(label)}{label==='采样方式'&&<HelpTip label={t('采样方式说明')}>{t('仅开始时固定目标值，锚点偏移仍随视点位置移动；每帧在过渡期间重新采样目标。')}</HelpTip>}{label==='目标值'&&<HelpTip label={t('目标值说明')}>{t('锚点偏移按 X、Y、Z 编辑；宽高比按分子和分母编辑。')}</HelpTip>}</span></th>)}</tr></thead><tbody>
    {channels.map(([name,label,icon])=>{
      const c=value[name];
      if(!c||typeof c!=='object'||Array.isArray(c))return <tr key={name}><th>{t(label)}</th><td colSpan={6} role="alert" className="range-error">{t('通道配置无效，请修复资产后重新载入')}</td></tr>;
      const types=valueTypes(name),vector=types.includes('Vector'),unknown=Object.keys(c).filter(k=>!['bEnabled','ValueType','Value','Reference','Sample','Curve',...(c.Reference==='Explicit'?(vector?['Origin','Rotation']:['Base']):[])].includes(k));
      const validCurve=assets.some((a:any)=>a.type==='Curve'&&a.path===assetFile(c.Curve,assets));
      return <tr key={name} data-value-channel={name} className={c.bEnabled?'':'range-disabled'}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={18}/><span>{t(label)}</span></div>{unknown.length>0&&<small role="alert" className="range-error">{unknown.join(', ')}</small>}</th>
        <td>{types.length===1&&c.ValueType===types[0]?<span title={c.ValueType}>{t(valueLabels[c.ValueType])}</span>:<Select label={name+'.ValueType'} value={c.ValueType} options={types} onChange={(next:string)=>onField(['Channels',name,'ValueType'],next,c.ValueType)}/>}</td>
        <td>{vector?<VectorInput name={name+'.Value'} value={c.Value} onChange={(next:any)=>onField(['Channels',name,'Value'],next,c.Value)}/>:name==='AspectRatio'?<RatioInput name={name+'.Value'} value={c.Value} validate={(n:number)=>valueError(name,c.Reference,n)} onChange={(next:number)=>onField(['Channels',name,'Value'],next,c.Value)}/>:scalar(name,['Value'],c.Value,(_label:string,n:number)=>valueError(name,c.Reference,n))}</td>
        <td><div className="value-reference"><ValueReferenceInput name={name} value={c.Reference} kind={c.ValueType} sequence={sequence} onChange={(next:string)=>onTransform((current:any)=>({...current,Channels:{...current.Channels,[name]:changeReference(current.Channels[name],next)}}))}/>{c.Reference==='Explicit'&&<div className="explicit-reference-fields">{vector?<>{[['Origin','原点'],['Rotation','旋转']].map(([group,label])=><label key={group}><span>{t(label)}</span><VectorInput name={name+'.'+group} axes={group==='Rotation'?['Pitch','Yaw','Roll']:undefined} value={c[group]} onChange={(next:any)=>onField(['Channels',name,group],next,c[group])}/></label>)}</>:<label><span>{t('基准值')}</span>{scalar(name,['Base'],c.Base)}</label>}</div>}</div></td>

        <td><Select label={name+'.Sample'} value={c.Sample} options={['OnlyAtStart','EveryFrame']} onChange={(next:string)=>onField(['Channels',name,'Sample'],next,c.Sample)}/></td>
        <td><AssetSlot compact hoverPreview value={c.Curve} type="Curve" label={'Channels.'+name+'.Curve'} assets={assets} onNavigate={onNavigate} onChange={(next:string)=>onField(['Channels',name,'Curve'],next,c.Curve)}/>{!validCurve&&<small className="range-error" role="alert">{t('请选择有效的曲线资产')}</small>}</td>
        <td><input type="checkbox" aria-label={name+'.bEnabled'} checked={c.bEnabled===true} onChange={e=>onField(['Channels',name,'bEnabled'],e.target.checked,c.bEnabled)}/></td></tr>;
    })}</tbody></FixedTable>
  </div>;
}
