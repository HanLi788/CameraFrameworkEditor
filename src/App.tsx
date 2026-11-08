import RigDirectorySelectors from './RigDirectorySelectors';
import {rigDirectories,rigLocation,directoryOptions,changeDirectory} from './rigDirectories.mjs';
import {flushRangeEdits} from './rangeDrafts';
import {t,tt,useLanguage,setLanguage} from './i18n';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Snapshot,collectReferences,filename,parse} from './types';
import DetailDialog from './DetailDialog';
import Icon,{IconButton,assetIcons} from './Icon';
import DirectoryTree from './DirectoryTree';
import RigWorkspace from './RigWorkspace';
import {buildRigTree,rigOwners,findOccurrence} from './rigGraph.mjs';
const api=window.cameraEditor;
const errorText=(e:any)=>String(e?.message||e).replace(/^Error invoking remote method '[^']+': Error: /,'');
export default function App(){
 useLanguage();const [project,setProject]=useState<Snapshot|null>(null),[session,setSession]=useState<any>({docs:[],busy:false}),[meta,setMeta]=useState<any>({file:'',tabs:[]});
 const [loaded,setLoaded]=useState(false),[recent,setRecent]=useState<string[]>([]),[dir,setDir]=useState('Assets'),[left,setLeft]=useState(260),[locate,setLocate]=useState<any>(null),[gameOpen,setGameOpen]=useState(false);
 const [issues,setIssues]=useState<any[]>([]),[message,setMessage]=useState('就绪'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[showIssues,setShowIssues]=useState(false);
 const [sidebarHidden,setSidebarHidden]=useState(false),[browse,setBrowse]=useState<any>(null);
 const treeViews=useRef<Record<string,any>>({});
 const commands=useRef<any>({}),latest=useRef<any>({});latest.current={project,session,meta,left,sidebarHidden};
 const report=(e:any)=>{setError(errorText(e));};const send=(p:Promise<any>)=>p.catch(report);
 const perform=async(fn:()=>Promise<any>)=>{setBusy(true);try{return await fn();}catch(e){report(e);}finally{setBusy(false);}};
 useEffect(()=>{const remove=api.onEvent((e:any)=>{
  if(e.type==='language')setLanguage(e.payload);if(e.type==='project'){setProject(e.payload);setIssues(e.payload.issues);}
  if(e.type==='session')setSession(e.payload);if(e.type==='window-meta')setMeta(e.payload);if(e.type==='game-window')setGameOpen(e.payload);
  if(e.type==='locate'){setSidebarHidden(false);api.preferences({layout:{sidebarHidden:false}}).catch(report);api.closeDetail().catch(report);setDir(e.payload.split('/').slice(0,-1).join('/'));setLocate({path:e.payload});setMessage('已在目录中定位');}
  if(e.type==='error')report(e.payload);if(e.type==='command')commands.current[e.payload]?.();
 });api.bootstrap().then((s:any)=>{setProject(s.project);setSession(s.session);setMeta(s.meta);setGameOpen(s.gameOpen);setLanguage(s.settings.language==='en'?'en':'zh');setRecent(s.settings.recent||[]);setLeft(s.settings.layout?.left||260);setSidebarHidden(s.settings.layout?.sidebarHidden===true);setIssues(s.project?.issues||[]);setLoaded(true);}).catch(report);return remove;},[]);
 const assets=useMemo(()=>project?.assets.map(a=>{const d=session.docs.find((d:any)=>d.path===a.path),data=d?(parse(d.text)||a.data):a.data;return {...a,data,refs:collectReferences(data)};})||[],[project,session]);
 const owners=useMemo(()=>rigOwners(assets),[assets]);
 const directories=useMemo(()=>rigDirectories(project?.directories||[],project?.files||[]),[project?.directories,project?.files]);
 const selection=directoryOptions(directories,browse||rigLocation(meta.canvasRig)||{});
 const standardRig=rigLocation(meta.canvasRig);
 const showCanvas=!!meta.canvasRig&&(!browse&&!standardRig||selection.paths.includes(meta.canvasRig));
 useEffect(()=>setBrowse(null),[meta.canvasRig,project?.root]);
 const tree=useMemo(()=>meta.canvasRig?buildRigTree(assets,meta.canvasRig):null,[assets,meta.canvasRig]);
 useEffect(()=>{treeViews.current={};},[project?.root]);
 const invalidDrafts=session.docs.some((d:any)=>d.dirty&&assets.some(a=>a.path===d.path)&&!parse(d.text));
 const doc=session.docs.find((d:any)=>d.path===meta.file),dirtyCount=session.docs.filter((d:any)=>d.dirty).length,disabled=busy||session.busy;
 const closeDetail=()=>send(api.closeDetail());
 const open=(path:string)=>{const rig=assets.find(a=>a.path===path)?.type==='Rig';if(rig)setBrowse(null);return send(api.openFile({path,mode:rig?'rig':'file',details:!rig}));};
 const selectDirectory=(field:string,value:string)=>{const next=changeDirectory(directories,selection,field,value);setBrowse({space:next.space,host:next.host,device:next.device});const path=next.paths.includes(meta.canvasRig)?meta.canvasRig:next.paths.length===1?next.paths[0]:null;if(path){setDir(path.split('/').slice(0,-1).join('/'));setLocate({path});send(api.openFile({path,mode:'rig',details:false}));}};
 const toggleSidebar=()=>{const hidden=!latest.current.sidebarHidden;setSidebarHidden(hidden);send(api.preferences({layout:{sidebarHidden:hidden}}));};
 const selectNode=(node:any)=>send(api.openFile({path:node.path,workspaceRig:meta.canvasRig,nodeKey:node.id}));
 const openDependency=(path:string)=>{const node=meta.workspaceRig&&tree&&findOccurrence(tree,path),rig=assets.find(a=>a.path===path)?.type==='Rig';return send(api.openFile({path,workspaceRig:node?meta.workspaceRig:rig?path:'',nodeKey:node?.id||'',navigation:'push'}));};
 const openOwner=(rig:string,path:string)=>{setBrowse(null);return send(api.openFile({path,workspaceRig:rig,navigation:meta.detailOpen?'push':undefined}));};
 const detailNode=meta.workspaceRig&&tree&&findOccurrence(tree,meta.file,meta.nodeKey);
 const siblings=detailNode?(tree.nodes.get(detailNode.parent)?.children||[]).filter((n:any)=>n.kind==='asset'&&n.issue!=='missing').map((n:any)=>({...n,selected:n.id===detailNode.id})):!meta.workspaceRig&&project?project.files.filter(f=>f.dir===meta.file?.split('/').slice(0,-1).join('/')&&(assets.some(a=>a.path===f.path)||/\.(md|lua|json|txt)$/i.test(f.path))).map(f=>({id:f.path,path:f.path,selected:f.path===meta.file})):[];
 const selectSibling=(node:any)=>node&&send(api.openFile({path:node.path,workspaceRig:meta.workspaceRig,nodeKey:node.id,navigation:'replace'}));
 async function save(all=false){const path=latest.current.meta.file;await flushRangeEdits(all?undefined:path);const current=await api.bootstrap();const docs=current.session.docs.filter((d:any)=>d.dirty&&(all||d.path===path));if(!docs.length)return;await api.saveSession({paths:docs.map((d:any)=>d.path),versions:Object.fromEntries(docs.map((d:any)=>[d.path,d.version]))});setMessage('保存完成');}
 async function validate(){await flushRangeEdits();await api.closeDetail();const r=await api.validate();setIssues(r.issues);setShowIssues(true);setMessage(tt`Lua 校验完成 · ${r.checked} 个资产通过 · ${r.issues.filter((i:any)=>i.severity==='error').length} 个错误`);}
 async function chooseProject(root?:string){const p=root?await api.openProject(root):await api.chooseProject();if(p){setProject(p);setDir('Assets');setLocate(null);setMessage('工作区已打开');}}
 commands.current={open:()=>perform(()=>chooseProject()),save:()=>perform(()=>save()),'save-all':()=>perform(()=>save(true)),undo:()=>meta.file&&send(api.history(meta.file,false)),redo:()=>meta.file&&send(api.history(meta.file,true)),validate:()=>perform(validate),'toggle-sidebar':toggleSidebar,'reset-layout':()=>{setLeft(260);setSidebarHidden(false);send(api.preferences({layout:{left:260,sidebarHidden:false}}));},'close-tab':()=>meta.detailOpen&&closeDetail()};
 const resize=(e:any)=>{e.preventDefault();const start=e.clientX,width=left;const move=(ev:PointerEvent)=>setLeft(Math.max(180,Math.min(520,width+ev.clientX-start)));const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);send(api.preferences({layout:{left:latest.current.left}}));};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);};
 const errors=error&&<div className="modal-overlay"><div className="modal"><h2>{t('操作未完成')}</h2><pre>{error}</pre><div className="modal-actions"><button onClick={()=>setError('')}>{t('关闭')}</button></div></div></div>;
 if(!loaded)return <div className="empty-state">{t('正在打开编辑工作区…')}{errors}</div>;
 if(!project)return <div className="welcome"><div className="welcome-grid"/><div className="welcome-content"><div className="brand-icon"><Icon name="camera" size={40}/></div><h1>{t('相机框架编辑器')}</h1><button className="primary large" onClick={()=>perform(()=>chooseProject())}>{t('选择 Lua 工作区目录')}</button><div className="recent"><h3>{t('最近打开')}</h3>{recent.map(root=><button key={root} onClick={()=>perform(()=>chooseProject(root))}><span><Icon name="folder"/>Lua</span><small>{root}</small></button>)}</div></div>{errors}</div>;
 return <div className="app-shell main-window workbench-window" inert={meta.detailOpen||undefined}>
  <header className="toolbar"><IconButton icon="sidebar" label={t(sidebarHidden?'显示目录':'隐藏目录')} title={t(sidebarHidden?'显示目录':'隐藏目录')+' (Ctrl+B)'} aria-controls="workspace-directory" aria-expanded={!sidebarHidden} onClick={toggleSidebar}/><div className="app-brand"><Icon name="camera" size={25}/><b>{t('相机框架')}</b></div><button onClick={()=>perform(()=>chooseProject())}><Icon name="folder"/>{t('打开工作区')}</button><div className="toolbar-divider"/><button disabled={disabled||!doc?.dirty} onClick={()=>perform(()=>save())}><Icon name="save"/>{t('保存')}</button><button disabled={disabled||!dirtyCount} onClick={()=>perform(()=>save(true))}><Icon name="saveAll"/>{t('全部保存')}</button><IconButton icon="undo" label={t('撤销')} disabled={disabled||!doc?.canUndo} onClick={()=>send(api.history(meta.file,false))}/><IconButton icon="redo" label={t('重做')} disabled={disabled||!doc?.canRedo} onClick={()=>send(api.history(meta.file,true))}/>{doc?.dirty&&<button onClick={()=>send(api.discard(meta.file))}>{t('还原草稿')}</button>}<div className="toolbar-divider"/><IconButton className="game-play" icon="play" label={t('打开游戏窗口')} disabled={disabled} onClick={()=>send(api.game('open'))}/><IconButton className="game-stop" icon="stop" label={t('结束游戏并关闭窗口')} disabled={!gameOpen} onClick={()=>send(api.game('close'))}/><div className="spacer"/><span className="project-path" title={project.workspaceRoot}>{project.workspaceRoot}</span><button onClick={()=>perform(validate)} disabled={disabled}><Icon name="check"/>{t('校验项目')} <kbd>F7</kbd></button></header>
  <div className="workbench-body" style={{gridTemplateColumns:sidebarHidden?'0px 0px minmax(0,1fr)':`${left}px 5px minmax(0,1fr)`}}><div id="workspace-directory" className="workbench-directory" hidden={sidebarHidden}><DirectoryTree project={project} dir={dir} onSelect={setDir} locate={locate} onOpen={open}/></div><div hidden={sidebarHidden} className="resize-handle vertical" onPointerDown={resize}/><main className="workbench-documents">
   <RigDirectorySelectors selection={selection} onChange={selectDirectory} disabled={disabled}/>
   {tree&&showCanvas?<RigWorkspace key={project.root+'|'+meta.canvasRig} rigPath={meta.canvasRig} tree={tree} owners={owners} meta={{file:meta.canvasSelection?.path||meta.canvasRig,nodeKey:meta.canvasSelection?.nodeKey||'root'}} docs={session.docs} view={treeViews.current[meta.canvasRig]} onView={(view:any)=>{treeViews.current[meta.canvasRig]=view;}} onSelect={selectNode} onOwner={openOwner}/>:<div className="workbench-empty"><Icon name="camera" size={64}/><h2>{t(selection.device?(selection.paths.length>1?'此目录包含多个装置文件，请从目录中选择':'此目录没有装置文件'):selection.space&&!selection.host?'此空间没有宿主目录':selection.host&&!selection.device?'此宿主没有装置目录':'选择装置，展开资产关系')}</h2>{selection.device&&selection.paths.length>1&&<button onClick={()=>{setSidebarHidden(false);setDir('Assets/CameraAssets/'+selection.space+'/'+selection.host+'/'+selection.device);setLocate({path:'Assets/CameraAssets/'+selection.space+'/'+selection.host+'/'+selection.device});send(api.preferences({layout:{sidebarHidden:false}}));}}>{t('显示目录')}</button>}</div>}
   {invalidDrafts&&<div className="graph-draft-warning"><Icon name="warning" size={14}/>{t('存在无效 JSON 草稿，相关引用树与共享统计暂按已保存结构显示。')}</div>}

  </main></div>
  <footer className="statusbar"><span className={'status-dot '+(disabled?'busy':'')}/><span className="status-message">{t(message)}</span><div className="spacer"/><button onClick={()=>setShowIssues(v=>!v)}>{t('诊断')} {issues.length||''}</button><span>{dirtyCount?dirtyCount+t(' 份共享草稿'):t('全部已保存')}</span><span>v0.6.0</span></footer>
  <DetailDialog effectCatalog={project.effectCatalog} inputCatalog={project.inputCatalog} meta={meta} session={session} assets={assets} owners={owners} siblings={siblings} onSibling={selectSibling} open={openDependency} onOwner={openOwner} onClose={closeDetail} onBack={()=>send(api.detailBack())} save={(all:boolean)=>perform(()=>save(all))} send={send} report={report} disabled={disabled} overlays={meta.detailOpen?errors:null}/>
  {showIssues&&<div className="modal-overlay"><div className="modal diagnostics"><h2>{t('项目诊断')}</h2>{issues.map((i,n)=><button className={'problem '+i.severity} key={n} onClick={()=>{if(i.path){open(i.path);setShowIssues(false);}}}><div><b>{i.message}</b><small>{i.path} {i.field}</small></div></button>)}<div className="modal-actions"><button onClick={()=>setShowIssues(false)}>{t('关闭')}</button></div></div></div>}{!meta.detailOpen&&errors}

 </div>;
}
