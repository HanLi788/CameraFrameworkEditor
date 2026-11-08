import {t} from './i18n';
export default function PostPlan({value,open}:any){return <div className="asset-form-scroll"><div className="effect-editor post-plan">
 <header><strong>{t('后处理执行计划')}</strong><span>{t('自动生成 · 只读')}</span><button onClick={()=>open('PostProcessing/Bindings.lua')}>{t('绑定源码')}</button></header>
 <section className="effect-card"><table className="range-table"><thead><tr><th>Id</th><th>{t('资产')}</th><th>{t('激活方式')}</th></tr></thead><tbody>{(value?.Bindings||[]).map((b:any)=><tr key={b.Id}><td>{b.Id}</td><td><button onClick={()=>open(b.Asset)}>{b.Asset}</button></td><td>{[b.Activation.Kind,b.Activation.Space,b.Activation.Name].filter(Boolean).join(' / ')}</td></tr>)}</tbody></table></section>
 <section className="effect-card"><table className="range-table"><thead><tr><th>{t('通道')}</th><th>{t('默认值')}</th><th>{t('响应时间常数（秒）')}</th></tr></thead><tbody>{Object.entries(value?.Channels||{}).map(([name,c]:any)=><tr key={name}><td>{name}</td><td>{c.Default}</td><td>{c.SmoothTime}</td></tr>)}</tbody></table></section>
 </div></div>;}
