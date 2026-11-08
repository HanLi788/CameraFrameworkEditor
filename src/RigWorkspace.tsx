import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import Icon,{IconButton,assetIcons} from './Icon';
import SharedUsage from './SharedUsage';
import {filename} from './types';
import {ancestorIds,findOccurrence,layoutRigTree} from './rigGraph.mjs';
import {t} from './i18n';
export default function RigWorkspace({rigPath,tree,owners,meta,docs,view,onView,onSelect,onOwner}:any){
 const selected=findOccurrence(tree,meta.file,meta.nodeKey)||tree.root,viewport=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 const [zoom,setZoom]=useState(view?.zoom||.85),[pan,setPan]=useState(view?.pan||{x:0,y:0});
 const gesture=useRef<any>(null),anchor=useRef<any>(null),currentZoom=useRef(zoom);currentZoom.current=zoom;
 const [expanded,setExpanded]=useState<Set<string>>(()=>new Set(view?.expanded||['root']));
 const layout=useMemo(()=>layoutRigTree(tree,expanded),[tree,expanded]);
 const previousSelection=useRef(view?selected?.id:'');
 const saveView=()=>onView({zoom,pan,expanded:[...expanded],scroll:{x:viewport.current?.scrollLeft||0,y:viewport.current?.scrollTop||0}});
 useLayoutEffect(()=>{if(view?.scroll)viewport.current?.scrollTo(view.scroll.x,view.scroll.y);},[]);
 useEffect(saveView,[zoom,pan,expanded]);
 useEffect(()=>{setExpanded(old=>{const next=new Set(old);for(const id of ancestorIds(tree,selected))next.add(id);return next.size===old.size?old:next;});},[selected?.id]);
 useLayoutEffect(()=>{
  if(previousSelection.current===selected?.id)return;
  const box=viewport.current,node=box?.querySelector<HTMLElement>('[data-node-selected="true"]');
  if(box&&node){previousSelection.current=selected?.id;const r=node.getBoundingClientRect(),b=box.getBoundingClientRect();if(r.left<b.left||r.right>b.right)box.scrollLeft+=r.left-b.left-24;if(r.top<b.top||r.bottom>b.bottom)box.scrollTop+=r.top-b.top-40;}
 },[selected?.id,layout]);
 useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=(e:WheelEvent)=>{if(!e.ctrlKey||!content.current)return;e.preventDefault();const r=content.current.getBoundingClientRect();anchor.current={x:e.clientX,y:e.clientY,u:(e.clientX-r.left)/currentZoom.current,v:(e.clientY-r.top)/currentZoom.current};setZoom(z=>Math.max(.25,Math.min(2,z*Math.exp(-e.deltaY*(e.deltaMode===1?.03:.002)))));};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 useLayoutEffect(()=>{const a=anchor.current,r=content.current?.getBoundingClientRect();if(a&&r){setPan((p:any)=>({x:p.x+a.x-r.left-a.u*zoom,y:p.y+a.y-r.top-a.v*zoom}));anchor.current=null;}},[zoom]);
 const toggle=(id:string)=>setExpanded(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});
 const fit=()=>{const box=viewport.current;if(!box)return;const next=Math.max(.25,Math.min(1,(box.clientWidth-24)/layout.width,(box.clientHeight-24)/layout.height));setZoom(next);setPan({x:Math.max(0,(box.clientWidth-layout.width*next)/2),y:Math.max(0,(box.clientHeight-layout.height*next)/2)});box.scrollTo(0,0);};
 const dirty=new Set(docs.filter((d:any)=>d.dirty).map((d:any)=>d.path)),trail=new Set(ancestorIds(tree,selected));
 const issueText:any={missing:'引用资产不存在',cycle:'检测到循环引用',limit:'依赖树过大，请从对应资产继续查看'};
 return <section className="rig-workspace full-workspace" aria-label={t('装置工作区')} data-rig-workspace={rigPath}>
 <header className="rig-workspace-heading"><Icon name="camera"/><strong title={rigPath}>{filename(rigPath)}</strong><div className="spacer"/><button onClick={fit}>{t('适应画布')}</button><select aria-label={t('资产树缩放')} value={zoom} onChange={e=>setZoom(+e.target.value)}>{[...new Set([.45,.6,.75,.85,1,1.25,zoom])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{Math.round(n*100)}%</option>)}</select><IconButton icon="locate" label={t('装置根节点')} onClick={()=>onSelect(tree.root)}/><IconButton icon="open" label={t('编辑选中资产')} onClick={()=>onSelect(selected)}/></header>
 <div className="rig-graph-scroll" ref={viewport} onScroll={saveView} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==2)return;e.preventDefault();gesture.current={x:e.clientX,y:e.clientY,pan};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('panning');}} onPointerMove={e=>{const g=gesture.current;if(g)setPan({x:g.pan.x+e.clientX-g.x,y:g.pan.y+e.clientY-g.y});}} onPointerUp={e=>{gesture.current=null;e.currentTarget.classList.remove('panning');if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onLostPointerCapture={e=>{gesture.current=null;e.currentTarget.classList.remove('panning');}}>
 <div className="rig-graph horizontal-graph" ref={content} style={{width:layout.width,height:layout.height,zoom,translate:`${pan.x/zoom}px ${pan.y/zoom}px`}}>
  {Array.from({length:layout.maxDepth+1},(_,depth)=><div key={depth} className="rig-depth-column" data-depth-column={depth} style={{left:layout.padding+depth*layout.step-(layout.step-layout.nodeWidth)/2,width:layout.step,height:layout.height}}><span>{depth===0?t('装置'):t('挂载层级')+' '+depth}</span></div>)}
  <svg className="rig-connections" width={layout.width} height={layout.height} aria-hidden="true">{layout.links.map(({from,to}:any)=>{const x=from.x+from.width,y=from.y+from.height/2,endX=to.x,endY=to.y+to.height/2,middle=(x+endX)/2;return <path key={to.node.id} data-link-to={to.node.id} className={trail.has(to.node.id)||selected?.id===to.node.id?'selected-link':''} d={`M ${x} ${y} C ${middle} ${y}, ${middle} ${endY}, ${endX} ${endY}`}/>;})}</svg>
  {layout.nodes.map(({node,depth,x,y,width,height}:any)=>{
   const active=selected?.id===node.id,open=expanded.has(node.id),hasChildren=node.children.length>0,parent=tree.nodes.get(node.parent);
   if(node.kind==='limit')return <div key={node.id} className="rig-graph-limit" style={{position:'absolute',left:x,top:y,width}}>{t(issueText.limit)}</div>;
   return <div key={node.id} className={'rig-node '+(node.id==='root'?'root-node ':'')+(active?'selected ':'')+(node.issue?'has-issue':'')} style={{left:x,top:y,width,height}} data-node-id={node.id} data-node-path={node.path||undefined} data-node-depth={depth} data-node-selected={active}>
    <button className="rig-node-main" title={node.path+(node.edge?'\n'+node.edge:'')} aria-pressed={active} onClick={()=>onSelect(node)} disabled={node.issue==='missing'}><span className={'type-'+node.asset?.type}><Icon name={assetIcons[node.asset?.type]||'file'}/></span><span className="rig-node-text"><b>{filename(node.path)}</b>{node.edge&&<small>{parent?.kind==='group'?t(parent.label):node.edge}</small>}</span>{dirty.has(node.path)&&<span className="node-dirty">●</span>}</button>
    <SharedUsage path={node.path} owners={owners.get(node.path.toLowerCase())} onOwner={onOwner}/>{node.issue&&<span className="node-warning" role="img" aria-label={t(issueText[node.issue])} title={t(issueText[node.issue])}><Icon name="warning" size={14}/></span>}{hasChildren&&<IconButton className="node-toggle" icon={open?'collapseRight':'expandRight'} label={t(open?'收起依赖':'展开依赖')+' '+filename(node.path)} aria-expanded={open} onClick={()=>toggle(node.id)}/>}
   </div>;
  })}
 </div></div></section>;
}
