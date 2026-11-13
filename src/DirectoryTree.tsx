import {useEffect,useRef,useState} from 'react';
import {t} from './i18n';
import Icon from './Icon';
const parent=(p:string)=>p.split('/').slice(0,-1).join('/');
export default function DirectoryTree({project,dir,onSelect,locate}:any){
 const [expanded,setExpanded]=useState<Set<string>>(new Set()),[search,setSearch]=useState('');
 const treeRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{setExpanded(new Set());setSearch('');},[project.root]);
 useEffect(()=>{if(!locate)return;setSearch('');const path=parent(locate.path);setExpanded(old=>{const next=new Set(old);path.split('/').forEach((_:string,i:number,parts:string[])=>next.add(parts.slice(0,i+1).join('/')));return next;});},[locate]);
 useEffect(()=>{treeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[locate]);
 const toggle=(p:string)=>setExpanded(old=>{const next=new Set(old);next.has(p)?next.delete(p):next.add(p);return next;});
 const row=(p:string,depth:number):any=>{const children=project.directories.filter((d:string)=>parent(d)===p),open=expanded.has(p);return <div key={p} role="treeitem" aria-expanded={children.length?open:undefined} aria-selected={dir===p}><div className={'folder-row '+(dir===p?'selected':'')} style={{paddingLeft:10+depth*15}}><button className="folder-toggle" aria-label={t(open?'收起目录 ':'展开目录 ')+p} disabled={!children.length} onClick={()=>toggle(p)}>{children.length>0&&<Icon name={open?'down':'chevron'} size={12}/>}</button><button className="folder-name" data-folder-path={p} title={p} onClick={()=>onSelect(p)} onDoubleClick={()=>toggle(p)}><Icon name="folder" size={16}/><span>{p.split('/').at(-1)}</span></button></div>{open&&<div role="group">{children.sort().map((d:string)=>row(d,depth+1))}</div>}</div>;};
 return <aside className="directory-panel folder-directory" onContextMenu={e=>e.preventDefault()}><div className="panel-heading">{t('资产目录')}<button aria-label={t('全部收起')} onClick={()=>setExpanded(new Set())}><Icon name="up" size={14}/></button></div><input className="tree-search" aria-label={t('搜索文件夹')} placeholder={t('搜索文件夹…')} value={search} onChange={e=>setSearch(e.target.value)}/><div ref={treeRef} className="tree-scroll" role="tree" aria-label={t('文件夹')}>{search?project.directories.filter((p:string)=>p.startsWith('Assets')&&p.toLowerCase().includes(search.toLowerCase())).map((p:string)=><button className="folder-search-result" key={p} onClick={()=>onSelect(p)} title={p}><Icon name="folder"/>{p.replace('Assets/','')}</button>):row('Assets',0)}</div><div className="directory-footer">{t('文件夹导航')} · {project.assets.length} {t('个资产')}</div></aside>;
}
