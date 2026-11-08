import HelpTip from './HelpTip';
import {t} from './i18n';
import {useEffect,useRef,useState} from 'react';
import {filename,typeNames} from './types';
import Icon,{IconButton,assetIcons} from './Icon';
const api=window.cameraEditor, parent=(p:string)=>p.split('/').slice(0,-1).join('/');
const generated=(p:string)=>p.toLowerCase().endsWith('.postprocessingplan');
const extension=(p:string)=>/\.[^./]+$/.exec(p)?.[0]||'';
export default function DirectoryTree({project,dir,onSelect,locate,onOpen}:any){
 const [expanded,setExpanded]=useState(new Set(['Assets','Assets/CameraAssets'])),[selected,setSelected]=useState('Assets'),[search,setSearch]=useState(''),[menu,setMenu]=useState<any>(null),[modal,setModal]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[clipboard,setClipboard]=useState('');
 const treeRef=useRef<HTMLElement>(null);
 useEffect(()=>{setSelected('Assets');setExpanded(new Set(['Assets','Assets/CameraAssets']));setSearch('');},[project.root]);
 useEffect(()=>{if(!locate)return;setSearch('');setSelected(locate.path);setExpanded(old=>{const next=new Set(old),parts=locate.path.split('/');for(let i=1;i<parts.length;i++)next.add(parts.slice(0,i).join('/'));return next;});},[locate]);
 useEffect(()=>{treeRef.current?.querySelector('.tree-row.selected')?.scrollIntoView({block:'nearest'});},[locate,expanded]);
 const folder=(p:string)=>project.directories.includes(p)||p==='Assets';
 const targetDir=(p=selected)=>folder(p)?p:parent(p);
 const toggle=(p:string)=>setExpanded(old=>{const n=new Set(old);n.has(p)?n.delete(p):n.add(p);return n;});
 const choose=(p:string)=>{setSelected(p);if(folder(p)){onSelect(p);toggle(p);}else onOpen(p);};
 const begin=(kind:string,p=selected,type='Rig')=>{if(generated(p)&&['move','copy','delete'].includes(kind)){setMenu(null);setError(t('执行计划为只读生成文件'));return;}const ext=folder(p)?'':extension(p);setError('');setMenu(null);setModal({kind,sourcePath:p,parent:targetDir(p),name:kind==='create-directory'?'NewFolder':kind==='create-asset'?'New'+type:filename(p).slice(0,ext? -ext.length:undefined),ext,type,sourceTemplate:project.assets.find((a:any)=>a.type===type)?.path||'',parentType:'Bezier'});};
 async function execute(data=modal){
  setBusy(true);setError('');try{
    if(!['delete'].includes(data.kind)&&(!data.name.trim()||/[\\/]/.test(data.name)))throw Error(t('请输入单个文件名'));
    const sourceIsFolder=folder(data.sourcePath),revision=['move','copy','delete'].includes(data.kind)&&!sourceIsFolder?(await api.read(data.sourcePath)).revision:undefined;
    const request:any={kind:data.kind,sourcePath:data.sourcePath,path:data.parent+'/'+data.name+data.ext,snapshotRevision:project.snapshotRevision,sourceRevision:revision};
    if(data.kind==='create-directory')request.path=data.parent+'/'+data.name;
    if(data.kind==='create-asset'){request.kind=data.type==='Curve'?'create-curve':'create-asset';request.type=data.type;request.sourcePath=data.sourceTemplate;request.parentType=data.parentType;request.path=data.parent+'/'+data.name+'.'+(data.type==='PostProcessing'?'postProcessing':data.type.toLowerCase());}
    const result=await api.mutate(request);setModal(null);setSearch('');setSelected(result.path||result.directory||data.parent);onSelect(result.directory||data.parent);setExpanded(old=>new Set([...old,data.parent]));if(result.path)onOpen(result.path,false);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const paste=()=>{if(!clipboard)return;const ext=folder(clipboard)?'':extension(clipboard);setModal({kind:'copy',sourcePath:clipboard,parent:targetDir(),name:filename(clipboard).slice(0,ext?-ext.length:undefined)+'_Copy',ext});setMenu(null);setError('');};
 const context=(e:any,p:string)=>{e.preventDefault();e.stopPropagation();setSelected(p);setMenu({x:e.clientX,y:e.clientY,path:p});};
 const row=(p:string,depth:number)=>{const isFolder=folder(p),a=project.assets.find((a:any)=>a.path===p);return <div className="tree-entry" key={p} style={{paddingLeft:8+depth*14}} onContextMenu={e=>context(e,p)} onDragOver={e=>{if(isFolder&&e.dataTransfer.types.includes('application/x-camera-path')){e.preventDefault();e.dataTransfer.dropEffect='move';}}} onDrop={e=>{const source=e.dataTransfer.getData('application/x-camera-path');if(!source||!isFolder)return;e.preventDefault();e.stopPropagation();if(source===p||parent(source)===p)return;const ext=folder(source)?'':extension(source);execute({kind:'move',sourcePath:source,parent:p,name:filename(source).slice(0,ext?-ext.length:undefined),ext});}}>
   <button className="tree-toggle" aria-label={t('展开目录 ')+p} aria-expanded={isFolder?expanded.has(p):undefined} onClick={()=>isFolder&&toggle(p)}>{isFolder&&<Icon name={expanded.has(p)?'down':'chevron'} size={12}/>}</button>
   <button className={'tree-row '+(!isFolder?'tree-asset ':'')+(selected===p?'selected':'')} data-tree-path={p} data-tree-asset={isFolder?undefined:p} title={p} draggable={p!=='Assets'&&!generated(p)} onDragStart={e=>{e.dataTransfer.setData('application/x-camera-path',p);e.dataTransfer.setData('text/plain',p);if(a)e.dataTransfer.setData('application/x-camera-asset',p);e.dataTransfer.effectAllowed=a?'all':'copyMove';}} onClick={()=>choose(p)}><span className={isFolder?'folder-icon':'type-'+a?.type}><Icon name={isFolder?'folder':generated(p)?'outputs':assetIcons[a?.type]||'file'} size={15}/></span><span>{filename(p)}</span>{generated(p)&&<Icon name="lock" size={12}/>}</button>
  </div>;};
 const tree=(p:string,depth=0):any=><>{project.directories.filter((d:string)=>d!==p&&parent(d)===p).sort().map((d:string)=><div key={d}>{row(d,depth)}{expanded.has(d)&&tree(d,depth+1)}</div>)}{project.files.filter((f:any)=>f.dir===p&&!f.name.startsWith('.')).sort((a:any,b:any)=>a.name.localeCompare(b.name)).map((f:any)=>row(f.path,depth))}</>;
 return <aside className="directory-panel workbench-tree" ref={treeRef} onClick={()=>setMenu(null)} onContextMenu={e=>context(e,'Assets')} onKeyDown={e=>{if((e.target as HTMLElement).tagName==='INPUT')return;if(e.key==='F2'&&selected!=='Assets'){e.preventDefault();begin('move');}if(e.key==='Delete'&&selected!=='Assets'){e.preventDefault();begin('delete');}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();setClipboard(selected);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();paste();}}}>
  <div className="panel-heading">{t('资产目录')}<div className="spacer"/><IconButton icon="plus" label={t('新建资产')} onClick={()=>begin('create-asset')}/><IconButton icon="folder" label={t('新建文件夹')} onClick={()=>begin('create-directory')}/></div>
  <input className="tree-search" aria-label={t('搜索资产')} placeholder={t('搜索文件…')} value={search} onChange={e=>setSearch(e.target.value)}/>
  <div className="tree-scroll">{row('Assets',0)}{search?project.files.filter((f:any)=>f.path.startsWith('Assets/')&&f.path.toLowerCase().includes(search.toLowerCase())).map((f:any)=>row(f.path,1)):expanded.has('Assets')&&tree('Assets',1)}</div>
  {error&&!modal&&<div className="notice" role="alert">{error}</div>}<div className="directory-footer">{project.assets.length} {t('个资产')}</div>
  {menu&&<div className="context-menu tree-context" style={{left:Math.min(menu.x,innerWidth-250),top:Math.min(menu.y,innerHeight-390)}} onClick={e=>e.stopPropagation()}>
   <button onClick={()=>setMenu({...menu,types:!menu.types})}><Icon name="plus"/>{t('新建资产')}<Icon name="chevron"/></button>{menu.types&&<div className="asset-type-menu">{Object.keys(typeNames).map(type=><button key={type} onClick={()=>begin('create-asset',menu.path,type)}>{type}</button>)}</div>}
   <button onClick={()=>begin('create-directory',menu.path)}><Icon name="folder"/>{t('新建文件夹')}</button>
   {menu.path!=='Assets'&&<><button onClick={()=>begin('move',menu.path)}>{t('重命名')} <small>F2</small></button><button onClick={()=>{setClipboard(menu.path);setMenu(null);}}>{t('复制')} <small>Ctrl+C</small></button><button onClick={()=>begin('delete',menu.path)}>{t('删除')} <small>Del</small></button></>}
   <button disabled={!clipboard} onClick={paste}>{t('粘贴')} <small>Ctrl+V</small></button><button onClick={()=>setMenu(null)}>{t('关闭菜单')}</button>
  </div>}
  {modal&&<div className="modal-overlay" onClick={e=>e.stopPropagation()}><div className="modal"><h2>{t(({move:'重命名',copy:'复制',delete:'删除','create-directory':'新建文件夹','create-asset':'新建资产'})[modal.kind])}</h2><p>{modal.kind==='delete'?modal.sourcePath:modal.parent}</p>
   {modal.kind==='create-asset'&&<><label>{t('资产类型')}<select aria-label={t('资产类型')} value={modal.type} onChange={e=>setModal({...modal,type:e.target.value,sourceTemplate:project.assets.find((a:any)=>a.type===e.target.value)?.path||''})}>{Object.keys(typeNames).map(type=><option key={type}>{type}</option>)}</select></label>{modal.type==='Curve'?<label>{t('曲线父类型')}<select aria-label={t('曲线父类型')} value={modal.parentType} onChange={e=>setModal({...modal,parentType:e.target.value})}><option>Bezier</option><option>CubicHermiteSpline</option></select></label>:<div className="modal-field"><span className="field-label">{t('模板')}<HelpTip label={t('模板')+' '+t('说明')}>{t('从模板创建合法资产；引用资产继续共享。')}</HelpTip></span><select aria-label={t('模板')} value={modal.sourceTemplate} onChange={e=>setModal({...modal,sourceTemplate:e.target.value})}>{project.assets.filter((a:any)=>a.type===modal.type).map((a:any)=><option key={a.path} value={a.path}>{a.path}</option>)}</select></div>}</>}
   {modal.kind==='delete'?<p>{t('被引用的资产不能删除；操作前保留恢复副本。')}</p>:<label>{t('名称')}<div className="filename-input"><input autoFocus aria-label={t('名称')} value={modal.name} onChange={e=>setModal({...modal,name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!busy)execute();if(e.key==='Escape')setModal(null);}}/><span data-fixed-extension>{modal.kind==='create-asset'?'.'+(modal.type==='PostProcessing'?'postProcessing':modal.type.toLowerCase()):modal.ext}</span></div></label>}
   {error&&<pre className="save-error" role="alert">{error}</pre>}<div className="modal-actions"><button disabled={busy} onClick={()=>setModal(null)}>{t('取消')}</button><button className="primary" disabled={busy||(modal.kind==='create-asset'&&modal.type!=='Curve'&&!modal.sourceTemplate)} onClick={()=>execute()}>{busy?t('处理中…'):t('确认')}</button></div>
  </div></div>}
 </aside>;
}
