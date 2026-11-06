import {t,tt} from './i18n';
import {useEffect,useRef,useState} from 'react';
import {Asset,filename,typeNames} from './types';
import Icon,{IconButton,assetIcons} from './Icon';
export {default as DirectoryTree} from './DirectoryTree';
const api=window.cameraEditor;

export default function ContentBrowser({project,assets,dir,onSelect,onOpen,issues,onValidate,locate}:any){
  const [search,setSearch]=useState(''),[filter,setFilter]=useState(''),[selected,setSelected]=useState(''),[problems,setProblems]=useState(false),[menu,setMenu]=useState<any>(null),[modal,setModal]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const browserRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(!locate)return;setSearch('');setFilter('');setProblems(false);setMenu(null);setSelected(locate.path);},[locate]);
  useEffect(()=>{if(!locate||selected!==locate.path||search||filter||problems)return;const card=[...(browserRef.current?.querySelectorAll<HTMLElement>('[data-file-path]')||[])].find(el=>el.dataset.filePath===locate.path);if(card){card.scrollIntoView({block:'nearest'});card.focus({preventScroll:true});}},[locate,selected,dir,search,filter,problems,project.files]);
  useEffect(()=>{setSelected('');setSearch('');setFilter('');setMenu(null);},[project.root]);
  const navigate=(p:string)=>{onSelect(p);setSearch('');setSelected('');setMenu(null);};
  function create(a?:Asset,directory=menu?.folder||dir){
    const type=a?.type||filter||(/CurveAssets(?:\/|$)/.test(directory)?'Curve':/ValueAssets(?:\/|$)/.test(directory)?'Value':'Rig'),source=a||assets.find((a:Asset)=>a.type===type);
    setError('');setModal({kind:type==='Curve'&&!a?'create-curve':'copy',sourcePath:source?.path,type,name:'NewCurve',parentType:'Bezier',path:directory+'/'+(type==='Curve'&&!a?'NewCurve.curve':'New'+(source?.path.match(/\.[^.]+$/)?.[0]||'.'+type.toLowerCase()))});setMenu(null);
  }
  function createFolder(){setError('');setModal({kind:'create-directory',parent:menu?.folder||dir,name:'NewFolder'});setMenu(null);}
  async function mutate(){
    setBusy(true);setError('');
    try{
      const source=assets.find((a:Asset)=>a.path===modal.sourcePath),revision=source?(await api.read(source.path)).revision:undefined;
      if(modal.kind==='create-directory'&&(!modal.name.trim()||/[\\/]/.test(modal.name)))throw Error(t('请输入单个文件夹名称'));
      const request=modal.kind==='create-directory'?{kind:modal.kind,path:modal.parent+'/'+modal.name}:{...modal};
      const result=await api.mutate({...request,snapshotRevision:project.snapshotRevision,sourceRevision:revision});
      setModal(null);setProblems(false);setSearch('');setFilter('');
      if(result.directory){onSelect(modal.parent);setSelected(result.directory);}
      else if(result.path){onSelect(result.path.split('/').slice(0,-1).join('/'));onOpen(result.path);}
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const files=project.files.filter((f:any)=>{const a=assets.find((a:Asset)=>a.path===f.path);return (search?f.path.startsWith('Assets/')&&`${f.path} ${a?.data?.Name||''}`.toLowerCase().includes(search.toLowerCase()):f.dir===dir)&&(!filter||a?.type===filter);}).sort((a:any,b:any)=>a.name.localeCompare(b.name));
  const folders=project.directories.filter((p:string)=>p.startsWith('Assets/')&&(search?p.toLowerCase().includes(search.toLowerCase()):p.split('/').slice(0,-1).join('/')===dir)).sort((a:string,b:string)=>a.localeCompare(b));
  const context=(e:any,data={})=>{e.preventDefault();e.stopPropagation();setMenu({x:e.clientX,y:e.clientY,...data});};
  return <section ref={browserRef} className="content-panel" onClick={()=>setMenu(null)} onContextMenu={e=>context(e)}>
    <div className="content-toolbar"><b>{t("内容浏览器")}</b><div className="spacer"/><button onClick={()=>create(undefined,dir)}><Icon name="plus"/>{t("新建资产")}</button><button onClick={()=>setProblems(v=>!v)}>{t("问题")}{issues.length||''}</button></div>
    {problems?<div className="problems"><div className="problem-heading"><span>{issues.length?tt`${issues.length} 条诊断`:t('没有发现问题')}</span><button onClick={onValidate}>{t("重新校验")}</button></div>{error&&<div className="notice">{error}</div>}{issues.map((i:any,n:number)=><button key={n} className={'problem '+i.severity} onClick={()=>i.path&&onOpen(i.path)}><Icon name="warning"/><div><b>{i.message}</b><small>{i.path} {i.field}</small></div></button>)}</div>:<>
      <div className="browser-navigation"><div className="breadcrumbs"><button onClick={()=>navigate('Assets')} title={t("Assets 根目录")} aria-label={t("Assets 根目录")}><Icon name="home"/></button>{dir.split('/').filter(Boolean).map((s:string,i:number)=><button key={i} onClick={()=>navigate(dir.split('/').slice(0,i+1).join('/'))}><Icon name="chevron" size={12}/>{s}</button>)}</div><select aria-label={t("资产类型筛选")} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">{t("所有文件")}</option>{Object.entries(typeNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><input aria-label={t("搜索资产")} className="search" placeholder={t("搜索 Assets 中的文件、文件夹…")} value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="asset-grid">
        {folders.map((p:string)=><button key={p} data-folder-path={p} className={'asset-card folder-card '+(selected===p?'selected':'')} title={p} onClick={()=>setSelected(p)} onDoubleClick={()=>navigate(p)} onContextMenu={e=>context(e,{folder:p})}><div className="asset-icon folder-icon"><Icon name="folder" size={32}/></div><strong>{filename(p)}</strong></button>)}
        {files.map((f:any)=>{const a=assets.find((a:Asset)=>a.path===f.path);return <button key={f.path} data-file-path={f.path} draggable={!!a} onDragStart={e=>{e.dataTransfer.setData('application/x-camera-asset',a.path);e.dataTransfer.setData('text/plain',a.path);e.dataTransfer.effectAllowed='link';}} className={'asset-card '+(selected===f.path?'selected':'')} title={f.path} onClick={()=>setSelected(f.path)} onDoubleClick={()=>onOpen(f.path)} onContextMenu={e=>context(e,{file:f,asset:a})}><div className={'asset-icon type-'+a?.type}><Icon name={assetIcons[a?.type]||(/\.lua$/.test(f.path)?'code':'file')} size={32}/></div><strong>{f.name}</strong></button>;})}
        {!files.length&&!folders.length&&<div className="empty-files">{t("当前目录没有匹配的内容")}<small>{t("右键新建文件夹或资产，或搜索 Assets。")}</small></div>}
      </div><div className="browser-footer">{folders.length}{' '}{t("个文件夹 ·")} {files.length}{' '}{t("个文件 · 双击文件夹进入，双击文件编辑")}</div>
    </>}
    {menu&&<div className="context-menu" style={{left:Math.max(8,Math.min(menu.x,innerWidth-240)),top:Math.max(8,Math.min(menu.y,innerHeight-300))}} onClick={e=>e.stopPropagation()}>
      <button onClick={createFolder}><Icon name="folder"/>{t("新建文件夹…")}</button><button onClick={()=>create()}><Icon name="plus"/>{t("新建资产")}</button>
      {menu.folder&&<button onClick={()=>navigate(menu.folder)}><Icon name="open"/>{t("进入文件夹")}</button>}
      {menu.asset&&<><button onClick={()=>create(menu.asset)}><Icon name="copy"/>{t("复制为新资产…")}</button><button onClick={()=>{setError('');setModal({kind:'move',sourcePath:menu.asset.path,path:menu.asset.path});setMenu(null);}}><Icon name="move"/>{t("移动 / 重命名文件…")}</button><button onClick={()=>{setError('');setModal({kind:'delete',sourcePath:menu.asset.path});setMenu(null);}}><Icon name="trash"/>{t("删除资产…")}</button></>}
      {menu.file&&<><button onClick={()=>{onOpen(menu.file.path);setMenu(null);}}><Icon name="open"/>{t("在编辑窗口打开")}</button><button onClick={()=>{api.reveal(menu.file.path).catch((e:any)=>{setError(e.message);setProblems(true);});setMenu(null);}}><Icon name="locate"/>{t("在内容浏览器中定位")}</button></>}
      <button onClick={()=>setMenu(null)}><Icon name="close"/>{t("关闭菜单")}</button>
    </div>}
    {modal&&<div className="modal-overlay" onClick={e=>e.stopPropagation()}><div className="modal"><h2>{({copy:t('新建资产'),'create-curve':t('新建曲线资产'),'create-directory':t('新建文件夹'),move:t('移动资产文件'),delete:t('删除资产')})[modal.kind]}</h2>
      {modal.kind==='create-directory'?<><p>{t("创建于")}{modal.parent}</p><label>{t("文件夹名称")}<input autoFocus aria-label={t("文件夹名称")} value={modal.name} onChange={e=>setModal({...modal,name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!busy)mutate();}}/></label></>:['copy','create-curve'].includes(modal.kind)?<>
        <p>{modal.kind==='create-curve'?t('创建独立曲线，编辑保存后可在引用处选择。'):t('从模板复制参数，关联资产继续共享。')}</p>
        <label>{t("资产类型")}<select aria-label={t("资产类型")} value={modal.type} onChange={e=>{const type=e.target.value,a=assets.find((a:Asset)=>a.type===type);setModal({...modal,kind:type==='Curve'?'create-curve':'copy',type,sourcePath:a?.path,path:modal.path.replace(/\.[^.]+$/,'.'+type.toLowerCase())});}}>{Object.entries(typeNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        {modal.kind==='create-curve'?<><label>{t("曲线名称")}<input aria-label={t("曲线名称")} value={modal.name} onChange={e=>{const name=e.target.value;setModal({...modal,name,path:[...modal.path.split('/').slice(0,-1),name+'.curve'].join('/')});}}/></label><label>{t("曲线父类型")}<select aria-label={t("曲线父类型")} value={modal.parentType} onChange={e=>setModal({...modal,parentType:e.target.value})}><option>Bezier</option><option>CubicHermiteSpline</option></select></label></>:<label>{t("模板")}<select aria-label={t("模板")} value={modal.sourcePath} onChange={e=>setModal({...modal,sourcePath:e.target.value})}>{assets.filter((a:Asset)=>a.type===modal.type).map((a:Asset)=><option key={a.path}>{a.path}</option>)}</select></label>}
      </>:<p>{modal.sourcePath}。{modal.kind==='delete'?t('仍被引用的资产不能删除；删除前保留恢复副本。'):t('将同步更新资产文件中的引用；业务 Lua 脚本中的路径需另行同步。')}</p>}
      {['copy','create-curve','move'].includes(modal.kind)&&<label>{t("目标文件路径")}<input aria-label={t("目标文件路径")} value={modal.path} onChange={e=>setModal({...modal,path:e.target.value})}/></label>}{error&&<pre className="save-error">{error}</pre>}
      <div className="modal-actions"><IconButton icon="close" label={t("取消")} disabled={busy} onClick={()=>setModal(null)}>{t("取消")}</IconButton><IconButton icon="check" label={t("确认")} className="primary" disabled={busy} onClick={mutate}>{busy?t('处理中…'):t('确认')}</IconButton></div>
    </div></div>}
  </section>;
}
