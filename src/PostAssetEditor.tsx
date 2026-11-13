import {useState} from 'react';
import Fields from './Fields';
import EffectTable from './EffectTable';
import {EffectSetField,EffectOutput} from './EffectFields';
import {t,useLanguage} from './i18n';
import {postChannelLabel,postGroupLabel} from './postProcessingLabels.mjs';
export default function PostAssetEditor({value,assetType,catalog,assets,onNavigate,onTransform,onField}:any){
 const language=useLanguage();
 const [group,setGroup]=useState(''),[query,setQuery]=useState(''),[presets,setPresets]=useState<any>({});
 const numeric=assetType==='NumEffect',channels=catalog?.postProcessing||[];
 const groups=[...new Set(channels.map((c:any)=>c.group))] as string[];
 const selected=groups.includes(group)?group:groups[0];
 const metadata={...value};delete metadata.Outputs;if(numeric){delete metadata.Source;delete metadata.Domain;}
 const change=(name:string,fn:any)=>onTransform((current:any)=>({...current,Outputs:{...current.Outputs,[name]:fn(current.Outputs[name])}}));
 const write=(name:string,enabled:boolean)=>onTransform((current:any)=>{const outputs={...current.Outputs};if(enabled)outputs[name]=numeric?{Range:'{0}'}:channels.find((c:any)=>c.name===name)?.default??0;else delete outputs[name];return {...current,Outputs:outputs};});
 const numericCatalog={...catalog,objects:(catalog?.postObjects||[]).map((o:any)=>({...o,interfaces:o.interfaces.filter((i:any)=>i.definition.ReturnType==='number')}))};
 return <div className="post-asset-editor">
  <Fields value={metadata} assetType={assetType} assets={assets} onNavigate={onNavigate} onField={onField}/>
  {numeric&&<EffectTable value={value} path="" catalog={numericCatalog} onTransform={onTransform} assets={assets} onNavigate={onNavigate} presets={presets} setPresets={setPresets} post numericPost propertiesOnly/>}
  <div className="post-asset-filter"><label>{t('后处理分组')}<select aria-label={t('后处理分组')} value={selected||''} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g} value={g}>{postGroupLabel(g,language)}</option>)}</select></label><input aria-label={t('搜索通道')} placeholder={t('搜索通道')} value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <table className="range-table"><thead><tr><th>{t('通道')}</th><th>{t(numeric?'增量值域':'值')}</th>{numeric&&<th>{t('映射曲线')}</th>}<th>{t('是否写入')}</th></tr></thead><tbody>
  {channels.filter((c:any)=>c.group===selected&&(`${c.name} ${postChannelLabel(c,language)}`).toLowerCase().includes(query.toLowerCase())).map((channel:any)=>{const name=channel.name,written=Object.hasOwn(value.Outputs||{},name),output=value.Outputs?.[name];return <tr key={name} data-post-channel={name}><th title={name}>{postChannelLabel(channel,language)}</th>
   {numeric?<><td>{written&&<EffectSetField path={'Outputs.'+name+'.Range'} domain={value.Domain} value={output?.Range} onChange={(Range:any)=>change(name,(old:any)=>({...old,Range}))}/>}</td><td>{written&&output&&<EffectOutput hideRange path={'Outputs.'+name} domain={value.Domain} value={output} assets={assets} onNavigate={onNavigate} onChange={(next:any)=>change(name,()=>next)}/>}</td></>:<td><input type="number" step="any" disabled={!written} aria-label={'Outputs.'+name} value={written?output:channel.default} onChange={e=>{const number=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(number))change(name,()=>number);}}/></td>}
   <td><input type="checkbox" aria-label={'Outputs.'+name+'.Write'} checked={written} onChange={e=>write(name,e.target.checked)}/></td></tr>;})}
  </tbody></table>
 </div>;
}
