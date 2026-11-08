import {useCallback,useState} from 'react';
import {t} from './i18n';
import Icon,{IconButton} from './Icon';
import HelpTip from './HelpTip';
import NumericInput from './NumericInput';
import AssetSlot from './AssetSlot';
import CellPanel from './CellPanel';
import {rangeChannels,rangeError} from './rangeChannels.mjs';
import {valueLabels,valueTypes,valueReferences,valueError,changeReference} from './valueChannels.mjs';

function Select({label,value,options,onChange}:any){return <select aria-label={label} title={String(value)} value={value??''} aria-invalid={!options.includes(value)} onChange={e=>onChange(e.target.value)}>{!options.includes(value)&&<option value={value??''}>{String(value??'—')}</option>}{options.map((key:string)=><option key={key} value={key}>{t(valueLabels[key]||key)}</option>)}</select>;}
export default function ValueTable({value,onField,onTransform,assets,onNavigate}:any){
  const [panel,setPanel]=useState<any>(null),close=useCallback(()=>setPanel(null),[]);
  const scalar=(name:string,keys:string[],v:any,validate:any=(_name:string,n:number)=>rangeError('',n,n))=><NumericInput single name={[name,...keys].join('.')} value={{Value:v}} validate={validate} onChange={(next:any)=>onField(['Channels',name,...keys],next.Value,v)}/>;
  const channel=panel?value[panel.name]:null;
  const extra=Object.keys(value).filter(key=>!rangeChannels.some(([name])=>name===key));
  return <div className="range-table-scroll">{extra.length>0&&<p role="alert" className="range-error">{t('存在旧版或未知字段，请在源码中修复：')}{extra.join(', ')}</p>}
    <table className="range-table value-table"><thead><tr>{['通道','值类型','目标值','参考系','采样方式','曲线','启用'].map(label=><th key={label}><span className="field-label">{t(label)}{label==='采样方式'&&<HelpTip label={t('采样方式说明')}>{t('仅开始时固定本次过渡的参考与目标；每帧会随参考对象重新计算目标值。')}</HelpTip>}{label==='目标值'&&<HelpTip label={t('目标值说明')}>{t('锚点偏移保留完整三分量，参考系变换后提取对应通道；角度和标量直接填写数值。')}</HelpTip>}</span></th>)}</tr></thead><tbody>
    {rangeChannels.map(([name,label,icon])=>{
      const c=value[name];
      if(!c||typeof c!=='object'||Array.isArray(c))return <tr key={name}><th>{t(label)}</th><td colSpan={6} role="alert" className="range-error">{t('通道配置无效，请在源码中修复')}</td></tr>;
      const types=valueTypes(name),vector=types.includes('Point'),unknown=Object.keys(c).filter(k=>!['bEnabled','ValueType','Value','Reference','Sample','Curve',...(c.Reference==='Explicit'?(vector?['Origin','Rotation']:['Base']):[])].includes(k));
      const validCurve=assets.some((a:any)=>a.type==='Curve'&&a.path===c.Curve);
      return <tr key={name} data-value-channel={name} className={c.bEnabled?'':'range-disabled'}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={18}/><span>{t(label)}</span></div>{unknown.length>0&&<small role="alert" className="range-error">{unknown.join(', ')}</small>}</th>
        <td>{types.length===1&&c.ValueType===types[0]?<span title={c.ValueType}>{t(valueLabels[c.ValueType])}</span>:<Select label={name+'.ValueType'} value={c.ValueType} options={types} onChange={(next:string)=>onField(['Channels',name,'ValueType'],next,c.ValueType)}/>}</td>
        <td>{vector?(Array.isArray(c.Value)&&c.Value.length===3?<div className="value-vector">{['X','Y','Z'].map((axis,i)=><label key={axis}><span>{axis}</span>{scalar(name,['Value',String(i)],c.Value[i])}</label>)}</div>:<small className="range-error" role="alert">{t('目标值必须是三分量数组，请在源码中修复')}</small>):scalar(name,['Value'],c.Value,(_label:string,n:number)=>valueError(name,c.Reference,n))}</td>
        <td><div className="value-reference"><Select label={name+'.Reference'} value={c.Reference} options={valueReferences(c.ValueType)} onChange={(next:string)=>onTransform((current:any)=>({...current,Channels:{...current.Channels,[name]:changeReference(current.Channels[name],next)}}))}/>{c.Reference==='Explicit'&&<IconButton icon="more" label={name+' '+t('参考参数')} onClick={e=>setPanel({name,anchor:e.currentTarget,vector})}/>}</div></td>
        <td><Select label={name+'.Sample'} value={c.Sample} options={['OnlyAtStart','EveryFrame']} onChange={(next:string)=>onField(['Channels',name,'Sample'],next,c.Sample)}/></td>
        <td><AssetSlot compact hoverPreview value={typeof c.Curve==='string'?c.Curve:''} type="Curve" label={'Channels.'+name+'.Curve'} assets={assets} onNavigate={onNavigate} onChange={(next:string)=>onField(['Channels',name,'Curve'],next,c.Curve)}/>{!validCurve&&<small className="range-error" role="alert">{t('请选择有效的曲线资产')}</small>}</td>
        <td><input type="checkbox" aria-label={name+'.bEnabled'} checked={c.bEnabled===true} onChange={e=>onField(['Channels',name,'bEnabled'],e.target.checked,c.bEnabled)}/></td></tr>;
    })}</tbody></table>
    {panel&&channel?.Reference==='Explicit'&&<CellPanel anchor={panel.anchor} title={panel.name+' '+t('参考参数')} onClose={close}><div data-numeric-document={panel.anchor.closest('[role="tabpanel"]')?.getAttribute('aria-label')}>{panel.vector?['Origin','Rotation'].map(group=><fieldset key={group}><legend>{t(group==='Origin'?'原点':'旋转')}</legend>{(group==='Origin'?['X','Y','Z']:['Pitch','Yaw','Roll']).map(axis=><label className="cell-parameter" key={axis}><span>{axis}</span>{scalar(panel.name,[group,axis],channel[group]?.[axis])}</label>)}</fieldset>):<label className="cell-parameter"><span>{t('基准值')}</span>{scalar(panel.name,['Base'],channel.Base)}</label>}</div></CellPanel>}
  </div>;
}
