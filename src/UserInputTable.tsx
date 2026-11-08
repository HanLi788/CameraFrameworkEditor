import MountSlots from './MountSlots';
import {useState} from 'react';
import {t} from './i18n';
import Icon,{IconButton} from './Icon';
import HelpTip from './HelpTip';
import NumericInput from './NumericInput';
import {rangeChannels,rangeError} from './rangeChannels.mjs';

export default function UserInputTable({value,onField,inputCatalog,assets,onNavigate}:any){
  const [refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
  const contexts=inputCatalog?.contexts||[],context=contexts.find((c:any)=>c.name===value.IMCName),mappings=context?.error?[]:context?.mappings||[];
  const validContext=!!context&&!context.error,channels=value.Channels;
  const unknown=Object.keys(value).filter(k=>!['SchemaVersion','Name','Description','Type','IMCName','SensitivityAssets','Channels'].includes(k));
  const refresh=async()=>{setRefreshing(true);setError('');try{await window.cameraEditor.snapshot();}catch(e){setError((e as Error).message);}finally{setRefreshing(false);}};
  return <div className="user-input-editor"><div className="input-context"><label htmlFor="user-input-imc">IMCName</label><select id="user-input-imc" aria-label="IMCName" aria-invalid={!validContext} value={value.IMCName??''} title={value.IMCName} onChange={e=>onField(['IMCName'],e.target.value,value.IMCName)}>{!context&&<option value={value.IMCName??''}>{String(value.IMCName??'—')}</option>}{contexts.map((c:any)=><option key={c.name} value={c.name} disabled={!!c.error}>{c.name}</option>)}</select><IconButton icon="reset" label={t('刷新输入定义')} disabled={refreshing} onClick={refresh}/></div>
    {!validContext&&<p role="alert" className="range-error">{t('IMCName 不存在或定义无效：')}{String(value.IMCName??'')}</p>}
    {error&&<p role="alert" className="range-error">{error}</p>}{inputCatalog?.issues.map((i:any,index:number)=><p role="alert" className="range-error" key={index}>{i.path}: {i.message}</p>)}
    {value.SchemaVersion!==5&&<p role="alert" className="range-error">{t('用户输入资产版本必须为 5')}</p>}
    {unknown.length>0&&<p role="alert" className="range-error">{t('存在旧版或未知字段，请在源码中修复：')}{unknown.join(', ')}</p>}
    {!channels||typeof channels!=='object'||Array.isArray(channels)?<p role="alert" className="range-error">{t('通道配置无效，请在源码中修复')}</p>:<>
      {Object.keys(channels).filter(k=>!rangeChannels.some(([name])=>name===k)).map(k=><p key={k} role="alert" className="range-error">{t('存在旧版或未知字段，请在源码中修复：')}{k}</p>)}
      <div className="range-table-scroll"><table className="range-table user-input-table"><thead><tr><th>{t('通道')}</th><th>MappingName</th><th><span className="field-label">{t('默认灵敏度')}<HelpTip label={t('默认灵敏度说明')}>{t('倍率允许正数、零和负数；负数反转方向，零不贡献增量，但不会让后面的输入源接替。')}</HelpTip></span></th><th>{t('启用')}</th></tr></thead><tbody>{rangeChannels.map(([name,label,icon])=>{
        const c=channels[name];
        if(!c||typeof c!=='object'||Array.isArray(c))return <tr key={name}><th>{t(label)}</th><td colSpan={3} role="alert" className="range-error">{t('通道配置无效，请在源码中修复')}</td></tr>;
        const missing=typeof c.MappingName!=='string'||(c.MappingName!==''&&!mappings.includes(c.MappingName))||(c.bEnabled&&c.MappingName==='');
        const extra=Object.keys(c).filter(k=>!['MappingName','DefaultSensitivity','bEnabled'].includes(k));
        return <tr key={name} data-user-channel={name} className={c.bEnabled?'':'range-disabled'}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={18}/><span>{t(label)}</span></div>{extra.length>0&&<small role="alert" className="range-error">{t('存在旧版或未知字段，请在源码中修复：')}{extra.join(', ')}</small>}</th>
          <td><select aria-label={name+'.MappingName'} aria-invalid={missing} value={c.MappingName??''} title={c.MappingName} onChange={e=>onField(['Channels',name,'MappingName'],e.target.value,c.MappingName)}><option value="" disabled={c.bEnabled}>—</option>{c.MappingName&&!mappings.includes(c.MappingName)&&<option value={c.MappingName}>{String(c.MappingName)}</option>}{mappings.map((mapping:string)=><option key={mapping} value={mapping}>{mapping}</option>)}</select>{missing&&<small role={c.bEnabled?'alert':undefined} className="range-error">{t(c.bEnabled?'请选择当前 IMCName 中有效的 MappingName':'该 MappingName 当前不可用；启用前需重新选择')}</small>}</td>
          <td><NumericInput single name={name+'.DefaultSensitivity'} value={{Value:c.DefaultSensitivity}} validate={(_n:string,n:number)=>rangeError('',n,n)} onChange={(next:any)=>onField(['Channels',name,'DefaultSensitivity'],next.Value,c.DefaultSensitivity)}/></td>
          <td><input type="checkbox" aria-label={name+'.bEnabled'} checked={c.bEnabled===true} onChange={e=>onField(['Channels',name,'bEnabled'],e.target.checked,c.bEnabled)}/></td></tr>;
      })}</tbody></table></div>
    </>}
    {Array.isArray(value.SensitivityAssets)?<MountSlots value={value.SensitivityAssets} onChange={(next:any)=>onField(['SensitivityAssets'],next,value.SensitivityAssets)} assets={assets} onNavigate={onNavigate} path="SensitivityAssets" type="Sensitivity" title={t('灵敏度资产')}/>:<p role="alert" className="range-error">{t('灵敏度挂载无效，请在源码中修复')}</p>}
  </div>;
}
