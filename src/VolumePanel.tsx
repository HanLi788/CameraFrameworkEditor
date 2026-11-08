import {useRef,useState} from 'react';
import {t,useLanguage} from './i18n';
import Icon from './Icon';
import SceneNumberInput from './SceneNumberInput';
import {postGroupLabel,postGroupIcon,postChannelLabel,matchesPostChannel} from './postProcessingLabels.mjs';
import {supportedVolumeChannels,defaultVolumeValues,overridePeers,setVolumeOverride} from './gameVolumes.mjs';
export default function VolumePanel({volumes,onChange,npcs,onNpcs,selected,group,onSelect,catalog,problem}:any){
 const language=useLanguage(),[search,setSearch]=useState(''),drafts=useRef<Record<string,any>>({});
 const npc=npcs.find((n:any)=>n.id===selected),volume=volumes.find((v:any)=>v.id===selected)||volumes[0];
 const update=(patch:any)=>onChange(volumes.map((v:any)=>v.id===volume.id?{...v,...patch}:v));
 const updateNpc=(patch:any)=>onNpcs(npcs.map((n:any)=>n.id===npc.id?{...n,...patch}:n));
 const number=(label:string,value:number,change:any,min?:number,max?:number)=><SceneNumberInput key={(npc?.id||volume.id)+label} label={label} value={value} onChange={change} min={min} max={max} integer={label===t('对话配置 ID')}/>;
 const vector=(key:string,value:number[],change:any,min=-1000000,max=1000000)=><div className="scene-vector">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}{number(key+'.'+axis,value[i],(n:number)=>change(value.map((v:number,j:number)=>j===i?n:v)),min,max)}</label>)}</div>;
 const cached=drafts.current[volume.id]||{};
 const remember=()=>drafts.current[volume.id]={...cached,...volume.values};
 const setOverride=(name:string,enabled:boolean)=>{remember();update({values:setVolumeOverride(volume.values,catalog,name,enabled,drafts.current[volume.id])});};
 const setValue=(name:string,value:number)=>update({values:{...setVolumeOverride(volume.values,catalog,name,true,cached),[name]:value}});
 const channels=catalog.filter((c:any)=>c.group===group&&matchesPostChannel(c,search));
 return <aside className="scene-inspector" aria-label={t('场景详情')}>
 {npc?<><header><Icon name="scene-npc"/><strong>{npc.name}</strong></header><section className="scene-card">
 <label>{t('名称')}<input aria-label={t('NPC 名称')} maxLength={64} value={npc.name} onChange={e=>updateNpc({name:e.target.value})}/></label>
 <label>{t('对话配置 ID')}{number(t('对话配置 ID'),npc.dialogueId,(n:number)=>{if(Number.isSafeInteger(n))updateNpc({dialogueId:n});},1,Number.MAX_SAFE_INTEGER)}</label>
 <label>{t('朝向')}{number(t('NPC 朝向'),npc.heading,(heading:number)=>updateNpc({heading}),-360,360)}</label>
 <span>{t('位置（厘米）')}</span>{vector('npc.position',npc.position,(position:number[])=>updateNpc({position}))}
 <button onClick={()=>{onNpcs(npcs.filter((n:any)=>n.id!==npc.id));onSelect('global','');}}>{t('删除 NPC')}</button></section></>:<>
 <header><Icon name={group?postGroupIcon(group):volume.global?'post-globe':'post-cube'}/><strong>{group?postGroupLabel(group,language):volume.global?t('全局后处理体积'):volume.name}</strong></header>
 <section className="scene-card scene-priority" aria-label={t('体积设置')}><label>{t('优先级')}{number(t('体积优先级'),volume.priority,(priority:number)=>update({priority}),-10000,10000)}</label>
 {!volume.global&&<label>{t('混合半径（厘米）')}{number(t('混合半径（厘米）'),volume.blend,(blend:number)=>update({blend}),0,100000)}</label>}
 <label>{t('混合权重')}{number(t('混合权重'),volume.weight,(weight:number)=>update({weight}),0,1)}</label></section>
 {!group?<section className="scene-card"><label>{t('名称')}<input aria-label={t('体积名称')} maxLength={64} disabled={volume.global} value={volume.global?t('全局后处理体积'):volume.name} onChange={e=>update({name:e.target.value})}/></label>
 {!volume.global&&<><label>{t('启用')}<input type="checkbox" aria-label={t('启用体积')} checked={volume.enabled} onChange={e=>update({enabled:e.target.checked})}/></label><span>{t('位置（厘米）')}</span>{vector('center',volume.center,(center:number[])=>update({center}))}<span>{t('尺寸（厘米）')}</span>{vector('size',volume.size,(size:number[])=>update({size}),1,2000000)}<button onClick={()=>{onChange(volumes.filter((v:any)=>v.id!==volume.id));onSelect('global','');}}>{t('删除体积')}</button></>}
 </section>:<section className="scene-channel-card"><div className="scene-table-tools"><input aria-label={t('搜索体积参数')} placeholder={t('搜索体积参数')} value={search} onChange={e=>setSearch(e.target.value)}/><button title={t('全部开启')} onClick={()=>{remember();update({values:{...defaultVolumeValues(catalog),...drafts.current[volume.id],...volume.values}});}}>{t('全部开启')}</button><button title={t('全部关闭')} onClick={()=>{remember();update({values:{}});}}>{t('全部关闭')}</button></div>
 <table className="scene-channel-table"><thead><tr><th>{t('通道')}</th><th>{t('值')}</th><th>{t('覆盖')}</th></tr></thead><tbody>{channels.map((c:any)=>{
 const peers=overridePeers(catalog,c.name),count=peers.filter((p:any)=>Object.hasOwn(volume.values,p.name)).length,enabled=Object.hasOwn(volume.values,c.name),value=volume.values[c.name]??cached[c.name]??c.default,min=c.positive?Math.max(c.minimum??0,1e-6):c.minimum,max=c.maximum,lo=Math.min(c.min??-100,value),hi=Math.max(c.max??100,value);
 return <tr key={c.name} data-channel={c.name}><td title={c.name+' · '+c.native+(supportedVolumeChannels.has(c.name)?'':' · '+t('仅配置，需在 UE 中验证'))}><Icon name={postGroupIcon(c.group)}/><span>{postChannelLabel(c,language)}</span>{!supportedVolumeChannels.has(c.name)&&<span className="scene-config-only" title={t('仅配置，需在 UE 中验证')}>◇</span>}</td><td><div className="scene-value"><input type="range" aria-label={c.name+'.Slider'} disabled={!enabled} min={min===undefined?lo:Math.max(min,lo)} max={max===undefined?hi:Math.min(max,hi)} step="any" value={value} onChange={e=>setValue(c.name,Number(e.target.value))}/>{enabled?number(c.name+'.Value',value,(n:number)=>setValue(c.name,n),min,max):<input aria-label={c.name+'.Value'} disabled value={value}/>}</div></td><td><input type="checkbox" aria-label={c.name+'.Override'} checked={count===peers.length} ref={el=>{if(el)el.indeterminate=count>0&&count<peers.length;}} title={peers.length>1?t('同一 UE 参数的分量共用覆盖开关'):t('覆盖')} onChange={e=>setOverride(c.name,e.target.checked)}/></td></tr>;
 })}</tbody></table></section>}
 </>}
 <footer>{t('WebGL 近似预览，最终效果以 UE 为准')}{problem&&<p role="alert">{t('混合结果超出有效范围')}：{problem}</p>}</footer>
 </aside>;
}
