import {t,tt} from './i18n';
import {useEffect,useRef,useState} from 'react';
import {filename} from './types';
import Icon,{assetIcons} from './Icon';

export default function DirectoryTree({project,dir,onSelect,locate}:any){
  const [expanded,setExpanded]=useState(new Set(['Assets','Assets/CameraAssets'])),[selectedFile,setSelectedFile]=useState(''),[error,setError]=useState('');
  const treeRef=useRef<HTMLElement>(null);
  useEffect(()=>{setSelectedFile('');setExpanded(new Set(['Assets','Assets/CameraAssets']));},[project.root]);
  useEffect(()=>{setExpanded(old=>{const next=new Set(old),parts=dir.split('/');for(let i=1;i<=parts.length;i++)next.add(parts.slice(0,i).join('/'));return next;});setSelectedFile(locate?.path||'');},[dir,locate]);
  useEffect(()=>{treeRef.current?.querySelector('.tree-row.selected')?.scrollIntoView({block:'nearest'});},[dir,locate,expanded]);
  const toggle=(p:string)=>setExpanded(old=>{const next=new Set(old);next.has(p)?next.delete(p):next.add(p);return next;});
  const select=(p:string)=>{setSelectedFile('');onSelect(p);};
  const tree=(parent:string,depth=0):any=>{
    const folders=project.directories.filter((p:string)=>p&&p.split('/').slice(0,-1).join('/')===parent).sort((a:string,b:string)=>a.localeCompare(b));
    const files=project.assets.filter((a:any)=>a.path.split('/').slice(0,-1).join('/')===parent).sort((a:any,b:any)=>a.path.localeCompare(b.path));
    return <>{folders.map((p:string)=>{const has=project.directories.some((d:string)=>d.startsWith(p+'/'))||project.assets.some((a:any)=>a.path.startsWith(p+'/'));return <div key={p}>
      <div className="tree-entry" style={{paddingLeft:8+depth*14}}><button className="tree-toggle" aria-label={t('展开目录 ')+p} aria-expanded={expanded.has(p)} disabled={!has} onClick={()=>toggle(p)}>{has&&<Icon name={expanded.has(p)?'down':'chevron'} size={12}/>}</button><button className={'tree-row '+(dir===p&&!selectedFile?'selected':'')} title={p} onClick={()=>select(p)} onDoubleClick={()=>toggle(p)}><Icon name="folder" size={15}/><span>{filename(p)}</span></button></div>
      {expanded.has(p)&&tree(p,depth+1)}
    </div>;})}{files.map((a:any)=><div className="tree-entry" key={a.path} style={{paddingLeft:26+depth*14}}><button className={'tree-row tree-asset '+(selectedFile===a.path?'selected':'')} data-tree-asset={a.path} title={a.path} onClick={()=>setSelectedFile(a.path)} onDoubleClick={()=>window.cameraEditor.reveal(a.path).catch((e:any)=>setError(e.message))}><span className={'type-'+a.type}><Icon name={assetIcons[a.type]} size={15}/></span><span>{filename(a.path)}</span></button></div>)}</>;
  };
  return <aside ref={treeRef} className="directory-panel"><div className="panel-heading">{t("资产目录")}</div><button className={'tree-root '+(dir==='Assets'?'selected':'')} onClick={()=>select('Assets')}><Icon name="folder"/> Assets</button><div className="tree-scroll">{tree('Assets')}</div>{error&&<div className="notice">{error}</div>}<div className="directory-footer">{project.assets.filter((a:any)=>a.path.startsWith('Assets/')).length}{' '}{t("个资产 · 双击文件定位")}</div></aside>;
}
