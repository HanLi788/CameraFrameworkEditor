import {t} from './i18n';
import Icon from './Icon';
import HelpTip from './HelpTip';
import {EffectSetField,EffectOutput} from './EffectFields';

// Both effect and postprocessing assets edit the same sparse increment mappings.
export default function EffectChannelTable({rows,title,domain,assets,onNavigate,onOutput,onWrite,post=false,mode='Add'}:any){
 return <div className="range-table-scroll"><table className="range-table effect-channels" aria-label={title}><thead><tr>
  <th>{t('通道')}</th><th><span className="field-label">{t(mode==='Target'?'目标值域':'增量值域')}<HelpTip label={t(mode==='Target'?'目标值域':'增量值域')+' '+t('说明')}>{t(mode==='Target'?'值域是目标参数范围，只有本通道最高优先级的有效目标参与输出。':'值域是增量贡献范围，例如 [-20,0] 或 {5}；单点值域可省略曲线。')}</HelpTip></span></th><th>{t('映射曲线')}</th><th>{t('是否写入')}</th>
 </tr></thead><tbody>{rows.map(({name,label,icon,written,value:v,unknown,native}:any)=><tr key={name} data-effect-channel={name} data-post-channel={post?name:undefined} data-written={written}>
  <th scope="row"><div className="range-channel" title={[name,native&&native!==name?native:null].filter(Boolean).join('\n')}><Icon name={icon} size={18}/><span>{label}</span></div>{unknown&&<small role="alert" className="range-error">{t('未知效果通道')}</small>}</th>
  {v&&typeof v==='object'&&!Array.isArray(v)?<><td><EffectSetField path={'Outputs.'+name+'.Range'} value={v.Range} domain={domain} onChange={(Range:any)=>onOutput(name,(old:any)=>({...old,Range}))}/></td><td><EffectOutput hideRange path={'Outputs.'+name} value={v} domain={domain} assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onOutput(name,()=>next)}/></td></>:<td colSpan={2} role="alert">{t('通道配置无效，请在源码中修复')}</td>}
  <td className="effect-write"><input type="checkbox" aria-label={'Outputs.'+name+'.Write'} title={t('是否写入')} checked={written} onChange={e=>onWrite(name,e.target.checked)}/></td>
 </tr>)}</tbody></table></div>;
}
