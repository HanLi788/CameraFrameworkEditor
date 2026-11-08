import EffectTable from './EffectTable';
import PostBindings from './PostBindings';
import {useEffect,useMemo,useRef,useState} from 'react';
import {parse,format} from './types';
import {t,useLanguage,setLanguage} from './i18n';
import Icon,{IconButton} from './Icon';
import EffectChannelTable from './EffectChannelTable';
import {postGroupLabel,postGroupIcon,postChannelLabel,matchesPostChannel} from './postProcessingLabels.mjs';
import {flushRangeEdits} from './rangeDrafts';
const api=window.cameraEditor;
const clampRatio=(value:number)=>Math.max(.2,Math.min(.6,Number.isFinite(value)?value:.4));
export default function PostProcessingWindow(){
 const [bindingState,setBindingState]=useState<any>({});
 const language=useLanguage();
 const [project,setProject]=useState<any>(null),[session,setSession]=useState<any>({docs:[]}),[meta,setMeta]=useState<any>({}),[group,setGroup]=useState('Exposure'),[search,setSearch]=useState(''),[error,setError]=useState(''),[sourceMode,setSourceMode]=useState(false),[presets,setPresets]=useState<any>({}),[ratio,setRatio]=useState(.4);
 const layout=useRef<HTMLDivElement>(null),queue=useRef<Promise<any>>(Promise.resolve()),latest=useRef<any>({});latest.current={session,meta,ratio};
 const report=(e:any)=>setError(String(e?.message||e));
 const persistRatio=(next:number)=>{next=clampRatio(next);setRatio(next);api.preferences({layout:{postProcessingRatio:next}}).catch(report);};
 useEffect(()=>{
  const off=api.onEvent((e:any)=>{
   if(e.type==='flush-live-debug')flushRangeEdits().then(()=>queue.current).then(()=>api.liveDebugFlushed(e.payload),error=>api.liveDebugFlushed(e.payload,String(error?.message||error))).catch(report);
   if(e.type==='project')setProject(e.payload);if(e.type==='session')setSession(e.payload);if(e.type==='language')setLanguage(e.payload);if(e.type==='window-meta')setMeta(e.payload);
   if(e.type==='postprocess-close-request')queue.current.then(()=>api.closePostProcessing()).catch(report);if(e.type==='error')report(e.payload);
   if(e.type==='command'){const file=latest.current.meta.file;
    if(e.payload==='save'||e.payload==='save-all')latest.current.save?.(e.payload==='save-all').catch(report);
    if(e.payload==='undo'||e.payload==='redo')queue.current.then(()=>api.history(latest.current.historyPath||file,e.payload==='redo')).catch(report);
    if(e.payload==='reset-layout')persistRatio(.4);
   }
  });
  api.bootstrap().then((s:any)=>{setProject(s.project);setSession(s.session);setMeta(s.meta);setRatio(clampRatio(s.settings.layout?.postProcessingRatio??.4));setLanguage(s.settings.language==='en'?'en':'zh');}).catch(report);return off;
 },[]);
 const doc=session.docs.find((d:any)=>d.path===meta.file),value=doc&&parse(doc.text);
 useEffect(()=>{setPresets({});setSourceMode(false);},[meta.file]);
 useEffect(()=>{if(value?.Outputs&&!Array.isArray(value.Outputs))setPresets((old:any)=>({...old,...structuredClone(value.Outputs)}));},[doc?.text]);
 const assets=useMemo(()=>project?.assets.map((a:any)=>({...a,data:parse(session.docs.find((d:any)=>d.path===a.path)?.text||'')||a.data}))||[],[project,session]);
 const domain=value?.Domain;
 const bindingsDoc=session.docs.find((d:any)=>d.path==='PostProcessing/Bindings.lua');
 useEffect(()=>{api.postBindings().then(setBindingState).catch(report);},[bindingsDoc?.text]);
 const catalogue=project?.effectCatalog?.postProcessing||[];
 const groups=([...new Set(catalogue.map((c:any)=>c.group))] as string[]).filter(g=>catalogue.some((c:any)=>c.group===g&&matchesPostChannel(c,search)));
 const activeGroup=group==='$bindings'?group:groups.includes(group)?group:groups[0]||group;
 const selected=catalogue.filter((c:any)=>c.group===activeGroup&&matchesPostChannel(c,search));
 const outputValid=value?.Outputs&&typeof value.Outputs==='object'&&!Array.isArray(value.Outputs);
 const edit=(transform:any)=>{queue.current=queue.current.then(async()=>{const state=await api.ensure(meta.file),current=state.docs.find((d:any)=>d.path===meta.file);if(!current)throw Error('Document not open');const next=transform(parse(current.text));setSession(await api.editText({path:meta.file,baseText:current.text,text:typeof next==='string'?next:format(next)}));}).catch(report);return queue.current;};
 const preset=(name:string)=>presets[name]||{Range:'{'+(value?.Mode==='Target'?(catalogue.find((c:any)=>c.name===name)?.default??0):0)+'}'};
 const update=(name:string,fn:any)=>{if(Object.hasOwn(value.Outputs,name))edit((v:any)=>Object.hasOwn(v.Outputs,name)?{...v,Outputs:{...v.Outputs,[name]:fn(v.Outputs[name])}}:v);else setPresets((v:any)=>({...v,[name]:fn(v[name]||preset(name))}));};
 const write=(name:string,enabled:boolean)=>{const cached=structuredClone(preset(name));edit((v:any)=>{const next={...v.Outputs};if(enabled){if(!Object.hasOwn(next,name))next[name]=cached;}else{if(Object.hasOwn(next,name)){const previous=structuredClone(next[name]);setPresets((p:any)=>({...p,[name]:previous}));}delete next[name];}return {...v,Outputs:next};});};
 const save=async(all=false)=>{await queue.current;const s=await api.ensure(meta.file),docs=s.docs.filter((d:any)=>d.dirty&&(all||d.path===meta.file||d.path==='PostProcessing/Bindings.lua'));await api.saveSession({paths:docs.map((d:any)=>d.path),versions:Object.fromEntries(docs.map((d:any)=>[d.path,d.version]))});};
 const editBindings=(transform:any)=>{queue.current=queue.current.then(async()=>{const current=await api.postBindings();if(current.error)throw Error(current.error);const next=await api.postBindings({baseText:current.text,config:transform(current.config)});setBindingState(next);setSession(next.session);}).catch(report);return queue.current;};
 const historyDoc=activeGroup==='$bindings'&&!sourceMode?bindingsDoc:doc;
 latest.current.save=save;latest.current.historyPath=historyDoc?.path;
 const drag=useRef<any>(null);
 const resize=(e:React.PointerEvent<HTMLDivElement>)=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,ratio,width:Math.max(1,(layout.current?.clientWidth||1)-5),next:ratio};};
 if(!project||!doc)return <div className="empty-state">{t('正在加载…')}</div>;
 const checked=Object.keys(value?.Outputs||{}),unknown=checked.filter(n=>!catalogue.some((c:any)=>c.name===n));
 return <div className="post-window">
  <header className="post-toolbar"><Icon name="outputs" size={22}/><div className="post-title"><strong>{t('后处理通道')}</strong><small>{meta.file}</small></div><span>{(doc.dirty||bindingsDoc?.dirty)?t('未保存'):t('全部已保存')}</span><button onClick={()=>setSourceMode(v=>!v)}>{t(sourceMode?'资产':'源码')}</button><button disabled={!(doc.dirty||bindingsDoc?.dirty)||session.busy} onClick={()=>save().catch(report)}><Icon name="save"/>{t('保存')}</button><button disabled={session.busy} onClick={()=>save(true).catch(report)}>{t('全部保存')}</button><IconButton icon="undo" label={t('撤销')} disabled={!historyDoc?.canUndo||session.busy} onClick={()=>queue.current.then(()=>api.history(historyDoc.path,false)).catch(report)}/><IconButton icon="redo" label={t('重做')} disabled={!historyDoc?.canRedo||session.busy} onClick={()=>queue.current.then(()=>api.history(historyDoc.path,true)).catch(report)}/></header>
  {doc.conflict&&<div className="conflict-banner">{t('磁盘文件已变化，草稿已保留。')}<button onClick={()=>api.reload(meta.file).then(()=>setPresets({})).catch(report)}>{t('重新载入磁盘版本')}</button></div>}
  {error&&<div className="post-error" role="alert">{error}<IconButton icon="close" label={t('关闭')} onClick={()=>setError('')}/></div>}
  <div className="post-layout" ref={layout} style={{gridTemplateColumns:`minmax(0,${ratio}fr) 5px minmax(0,${1-ratio}fr)`}}>
   <nav className="post-directory" aria-label={t('后处理分组')}><button className={activeGroup==='$bindings'?'selected':''} onClick={()=>setGroup('$bindings')}><Icon name="link"/>{t('绑定与平滑')}</button><input aria-label={t('搜索通道')} placeholder={t('搜索通道')} value={search} onChange={e=>setSearch(e.target.value)}/>{groups.map(g=><button key={g} data-post-group={g} title={g} className={g===activeGroup?'selected':''} aria-pressed={g===activeGroup} onClick={()=>setGroup(g)}><Icon name={postGroupIcon(g)} size={20}/><span>{postGroupLabel(g,language)}</span><small>{catalogue.filter((c:any)=>c.group===g&&checked.includes(c.name)).length||''}</small></button>)}{!groups.length&&<p className="empty-state">{t('没有匹配的通道')}</p>}</nav>
   <div className="resize-handle vertical post-divider" role="separator" aria-label={t('调整后处理目录宽度')} aria-orientation="vertical" aria-valuemin={20} aria-valuemax={60} aria-valuenow={Math.round(ratio*100)} tabIndex={0} onPointerDown={resize} onPointerMove={e=>{if(drag.current){const d=drag.current;d.next=clampRatio(d.ratio+(e.clientX-d.x)/d.width);setRatio(d.next);}}} onLostPointerCapture={()=>{if(drag.current){persistRatio(drag.current.next);drag.current=null;}}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onDoubleClick={()=>persistRatio(.4)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();persistRatio(e.key==='Home'?.4:ratio+(e.key==='ArrowRight'?.02:-.02));}}}/>
   <main className="post-details effect-editor" aria-label={t('分组详情')}>
    {sourceMode||!value?<textarea className="post-source" aria-label={t('后处理源码')} value={doc.text} spellCheck={false} onChange={e=>{const text=e.target.value;edit(()=>text);}}/>:<><EffectTable post propertiesOnly value={value} catalog={{...project.effectCatalog,objects:project.effectCatalog.postObjects}} onTransform={edit} assets={assets} presets={{}} setPresets={()=>{}}/>{activeGroup==='$bindings'?<PostBindings path={meta.file} config={bindingState.config} error={bindingState.error} transform={editBindings} catalog={catalogue} outputs={value.Outputs}/>:<section className="effect-card">
     <header className="effect-table-heading"><h3><Icon name={postGroupIcon(activeGroup)} size={20}/>{postGroupLabel(activeGroup,language)}</h3></header>
     {unknown.length>0&&<p role="alert" className="range-error">{t('未知效果通道')} {unknown.join(', ')}</p>}
     {!outputValid?<p role="alert">{t('通道配置无效，请在源码中修复')}</p>:selected.length?<EffectChannelTable post mode={value.Mode} title={postGroupLabel(activeGroup,language)} domain={domain} assets={assets} onNavigate={(path:string)=>api.openFile({path}).catch(report)} onOutput={update} onWrite={write} rows={selected.map((c:any)=>{const written=Object.hasOwn(value.Outputs,c.name);return {name:c.name,label:postChannelLabel(c,language),native:c.native,icon:postGroupIcon(c.group),written,value:written?value.Outputs[c.name]:preset(c.name)};})}/>:<p className="empty-state">{t('没有匹配的通道')}</p>}
    </section>}</>}
   </main>
  </div>
 </div>;
}
