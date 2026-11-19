import FixedTable,{tableColumns} from './FixedTable';
import {assetFile} from './assetPaths.mjs';
import {t} from './i18n';
import Icon from './Icon';
import HelpTip from './HelpTip';
import NumericInput from './NumericInput';
import AssetSlot from './AssetSlot';
import {speedError,lagError,smoothHints} from './smoothChannels.mjs';
import {channelsFor} from './rangeChannels.mjs';

export default function SmoothTable({value,onField,assets,onNavigate}:any){
  const channels=channelsFor(value),extra=Object.keys(value).filter(key=>!channels.some(([name])=>name===key));
  return <div className="range-table-scroll">{extra.length>0&&<p className="range-error" role="alert">{t('存在旧版或未知字段：')}{extra.join(', ')}</p>}
    <FixedTable columns={tableColumns.smooth} className="range-table smooth-table"><thead><tr><th>{t('通道')}</th><th><span className="field-label">{t('平滑速率')}<HelpTip label={t('平滑速率说明')}>{t(smoothHints.speed)}</HelpTip></span></th><th><span className="field-label">{t('最大滞后')}<HelpTip label={t('最大滞后说明')}>{t(smoothHints.lag)}</HelpTip></span></th><th>{t('响应曲线')}</th><th>{t('启用')}</th></tr></thead><tbody>
    {channels.map(([name,label,icon])=>{
      const channel=value[name];
      if(!channel||typeof channel!=='object'||Array.isArray(channel))return <tr key={name}><th>{t(label)}</th><td colSpan={4} className="range-error" role="alert">{t('通道配置无效，请修复资产后重新载入')}</td></tr>;
      const speed=channel.SpeedRange,validSpeed=speed&&typeof speed==='object'&&!Array.isArray(speed);
      const unknown=[...Object.keys(channel).filter(k=>!['Type','bEnabled','SpeedRange','MaxLag','ResponseCurve'].includes(k)),...(validSpeed?Object.keys(speed).filter(k=>!['Min','Max'].includes(k)).map(k=>'SpeedRange.'+k):[])];
      const curvePath=channel.ResponseCurve;
      const validCurve=assets.some((a:any)=>a.type==='Curve'&&a.path===assetFile(curvePath,assets));
      return <tr key={name} data-smooth-channel={name} className={channel.bEnabled?'':'range-disabled'}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={18}/><span>{t(label)}</span></div>{unknown.length>0&&<small className="range-error" role="alert">{t('存在旧版或未知字段：')}{unknown.join(', ')}</small>}</th>
        <td>{validSpeed?<NumericInput name={name+'.SpeedRange'} value={speed} validate={speedError} onChange={(next:any)=>onField(['Channels',name,'SpeedRange'],next,speed)}/>:<small className="range-error" role="alert">{t('速率区间无效，请修复资产后重新载入')}</small>}</td>
        <td><NumericInput single name={name+'.MaxLag'} value={{Value:channel.MaxLag}} validate={lagError} onChange={(next:any)=>onField(['Channels',name,'MaxLag'],next.Value,channel.MaxLag)}/></td>
        <td><AssetSlot compact hoverPreview value={curvePath} type="Curve" label={'Channels.'+name+'.ResponseCurve'} assets={assets} onNavigate={onNavigate} onChange={(next:string)=>onField(['Channels',name,'ResponseCurve'],next,channel.ResponseCurve)}/>{!validCurve&&<small className="range-error" role="alert">{t('请选择有效的曲线资产')}</small>}</td>
        <td><input type="checkbox" aria-label={name+'.bEnabled'} checked={channel.bEnabled===true} onChange={e=>onField(['Channels',name,'bEnabled'],e.target.checked,channel.bEnabled)}/></td></tr>;
    })}</tbody></FixedTable>
  </div>;
}
