import {t} from './i18n';
import Icon from './Icon';
import HelpTip from './HelpTip';
import AssetSlot from './AssetSlot';
import {rangeChannels} from './rangeChannels.mjs';

export default function SensitivityTable({value,onField,assets,onNavigate}:any){
  const channels=value.Channels,extra=Object.keys(value).filter(k=>!['SchemaVersion','Name','Description','Channels'].includes(k));
  if(!channels||typeof channels!=='object'||Array.isArray(channels))return <p role="alert" className="range-error">{t('通道配置无效，请在源码中修复')}</p>;
  const fields=['EscapeCurve','ReturnCurve'],labels=['逃逸曲线','回归曲线'];
  const hints=['远离范围中值时使用。X 对应整个范围的位置，Y 直接乘默认灵敏度；默认恒为 1。','靠近范围中值时使用。倍率必须全域大于零，避免无法返回；默认恒为 1。'];
  return <div className="range-table-scroll">
    {value.SchemaVersion!==3&&<p role="alert" className="range-error">{t('灵敏度资产版本必须为 3')}</p>}
    {[...extra,...Object.keys(channels).filter(k=>!rangeChannels.some(([name])=>name===k))].map(k=><p key={k} role="alert" className="range-error">{t('存在旧版或未知字段，请在源码中修复：')}{k}</p>)}
    <table className="range-table sensitivity-table"><thead><tr><th>{t('通道')}</th>{labels.map((label,i)=><th key={label}><span className="field-label">{t(label)}<HelpTip label={t(label+'说明')}>{t(hints[i])}</HelpTip></span></th>)}<th>{t('启用')}</th></tr></thead><tbody>
      {rangeChannels.map(([name,label,icon])=>{
        const c=channels[name];if(!c||typeof c!=='object'||Array.isArray(c))return <tr key={name}><th>{t(label)}</th><td colSpan={3} className="range-error" role="alert">{t('通道配置无效，请在源码中修复')}</td></tr>;
        const unknown=Object.keys(c).filter(k=>!['bEnabled',...fields].includes(k));
        return <tr key={name} data-sensitivity-channel={name} className={c.bEnabled?'':'range-disabled'}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={18}/><span>{t(label)}</span></div>{unknown.length>0&&<small role="alert" className="range-error">{t('存在旧版或未知字段，请在源码中修复：')}{unknown.join(', ')}</small>}</th>
          {fields.map(field=><td key={field}><AssetSlot compact hoverPreview type="Curve" value={typeof c[field]==='string'?c[field]:''} label={'Channels.'+name+'.'+field} assets={assets} onNavigate={onNavigate} onChange={(next:string)=>onField(['Channels',name,field],next,c[field])}/>{!assets.some((a:any)=>a.type==='Curve'&&a.path===c[field])&&<small className="range-error" role="alert">{t('请选择有效的曲线资产')}</small>}</td>)}
          <td><input type="checkbox" aria-label={name+'.bEnabled'} checked={c.bEnabled===true} onChange={e=>onField(['Channels',name,'bEnabled'],e.target.checked,c.bEnabled)}/></td></tr>;
      })}</tbody></table>
  </div>;
}
