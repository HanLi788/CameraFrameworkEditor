import {useState} from 'react';
import {t,useLanguage} from './i18n';
import Icon,{IconButton} from './Icon';
import SceneNumberInput from './SceneNumberInput';
import {postChannelLabel,postGroupLabel,postGroupIcon,matchesPostChannel} from './postProcessingLabels.mjs';
import {previewPostChannels} from './GamePostProcessing';
export default function SceneInspector({catalog,values,group,overrides,onChange,onRestore}:any){
 const language=useLanguage(),[search,setSearch]=useState(''),[revision,setRevision]=useState(0);
 const restore=(name?:string)=>{onRestore(name);setRevision(n=>n+1);};
 const channels=catalog.filter((c:any)=>c.group===group&&matchesPostChannel(c,search));
 return <aside className="scene-inspector post-debug-inspector" aria-label={t('后处理参数')}>
 <header><Icon name={postGroupIcon(group)}/><strong>{postGroupLabel(group,language)}</strong><div className="spacer"/><IconButton icon="reset" label={t('恢复全部参数')} disabled={!Object.keys(overrides).length} onClick={()=>restore()}/></header>
 <section className="scene-channel-card"><div className="scene-table-tools"><input aria-label={t('搜索后处理参数')} placeholder={t('搜索后处理参数')} value={search} onChange={e=>setSearch(e.target.value)}/></div>
 <table className="scene-channel-table post-debug-table"><thead><tr><th>{t('通道')}</th><th>{t('值')}</th></tr></thead><tbody>{channels.map((c:any)=>{
 const overridden=Object.hasOwn(overrides,c.name),value=overrides[c.name]??values[c.name]??c.default;
 const min=c.positive?Math.max(c.minimum??0,1e-6):c.minimum,max=c.maximum;
 const lo=Math.max(min??-Infinity,Math.min(c.min??-100,value)),hi=Math.min(max??Infinity,Math.max(c.max??100,value));
 return <tr key={c.name} data-channel={c.name} data-overridden={overridden}><td title={c.name+' · '+c.native}><Icon name={postGroupIcon(c.group)}/><span>{postChannelLabel(c,language)}</span>{!previewPostChannels.has(c.name)&&<span className="scene-config-only" title={t('此通道暂不支持 WebGL 画面预览')}>◇</span>}</td><td><div className="post-debug-value"><div className="scene-value"><input type="range" aria-label={c.name+'.Slider'} min={lo} max={hi} step="any" value={value} onChange={e=>onChange(c.name,Number(e.target.value))}/><SceneNumberInput key={c.name+revision} label={c.name+'.Value'} value={value} onChange={(n:number)=>onChange(c.name,n)} min={min} max={max}/></div><IconButton icon="reset" label={t('恢复参数')+' '+c.name} disabled={!overridden} onClick={()=>restore(c.name)}/></div></td></tr>;
 })}</tbody></table>{!channels.length&&<div className="empty-state">{t('没有匹配的通道')}</div>}</section>
 <footer>{t('临时覆盖 · 退出调试后恢复')}<br/>{t('WebGL 近似预览，最终效果以 UE 为准')}</footer>
 </aside>;
}
