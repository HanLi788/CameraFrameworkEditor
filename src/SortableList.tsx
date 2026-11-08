import {t,tt} from './i18n';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import Icon from './Icon';

// Keep document edits out of pointer motion: one drop commits one undoable reorder.
export default function SortableList({items,onChange,renderItem,label,itemKey,table=false}: {items:any[];onChange:(items:any[])=>any;renderItem:(item:any,index:number)=>ReactNode;label:string;table?:boolean;itemKey?:(item:any,index:number)=>string}){
  const root=useRef<HTMLDivElement>(null),active=useRef<any>(null),cleanup=useRef<()=>void>(()=>{}),latest=useRef({items,onChange});latest.current={items,onChange};
  const [drag,setDrag]=useState<any>(null),[announcement,setAnnouncement]=useState<number|'cancel'|null>(null);
  useEffect(()=>()=>cleanup.current(),[]);
  const signature=JSON.stringify(items);
  useEffect(()=>{if(active.current&&active.current.signature!==signature)cleanup.current();},[signature]);
  function reorder(from:number,to:number){if(from===to)return;const next=[...latest.current.items],item=next.splice(from,1)[0];next.splice(to,0,item);const result=latest.current.onChange(next);Promise.resolve(result).then(ok=>{if(ok!==false)setAnnouncement(to+1);}).catch(()=>setAnnouncement('cancel'));}
  function start(e:React.PointerEvent<HTMLButtonElement>,index:number){
    if(e.button!==0||items.length<2)return;e.preventDefault();cleanup.current();
    const rows=[...root.current!.children] as HTMLElement[],rect=rows[index].getBoundingClientRect();
    const offsets=rows.map(row=>({top:row.offsetTop,height:row.offsetHeight}));
    const gap=offsets.length>1?offsets[1].top-offsets[0].top-offsets[0].height:0;
    const d={index,to:index,signature,offsets,height:rect.height,width:rect.width,left:rect.left,top:rect.top,dx:e.clientX-rect.left,dy:e.clientY-rect.top,x:e.clientX,y:e.clientY,gap};
    active.current=d;setDrag({...d});let frame=0;
    const scrollParents:HTMLElement[]=[];let parent=root.current!.parentElement;
    while(parent){if(/auto|scroll/.test(getComputedStyle(parent).overflowY))scrollParents.push(parent);parent=parent.parentElement;}
    function update(){
      if(!active.current||!root.current)return;
      const bounds=root.current.getBoundingClientRect(),center=d.y-d.dy+d.height/2-bounds.top;
      let nearest=0,distance=Infinity;offsets.forEach((row,i)=>{const delta=Math.abs(center-row.top-row.height/2);if(delta<distance){distance=delta;nearest=i;}});
      d.to=nearest;d.left=d.x-d.dx;d.top=d.y-d.dy;setDrag({...d});
    }
    const move=(event:PointerEvent)=>{if(event.pointerId!==e.pointerId)return;event.preventDefault();d.x=event.clientX;d.y=event.clientY;update();};
    const stop=(commit:boolean)=>{const target=d.to;cleanup.current();if(commit)reorder(index,target);else setAnnouncement('cancel');};
    const up=(event:PointerEvent)=>{if(event.pointerId===e.pointerId)stop(true);};
    const cancel=()=>stop(false);
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}};
    const tick=()=>{for(const el of scrollParents){const b=el.getBoundingClientRect();if(d.x<b.left||d.x>b.right)continue;const speed=d.y<b.top+40?-Math.min(14,(b.top+40-d.y)/3):d.y>b.bottom-40?Math.min(14,(d.y-b.bottom+40)/3):0;if(speed){el.scrollTop+=speed;update();break;}}frame=requestAnimationFrame(tick);};
    cleanup.current=()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);document.body.classList.remove('sorting-assets');active.current=null;setDrag(null);cleanup.current=()=>{};};
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);document.body.classList.add('sorting-assets');frame=requestAnimationFrame(tick);
  }
  return <><div ref={root} role={table?'rowgroup':undefined} className="sortable-list" data-sorting={!!drag}>{items.map((item,index)=>{
    const shift=!drag||index===drag.index?0:drag.index<drag.to&&index>drag.index&&index<=drag.to?-(drag.height+drag.gap):drag.index>drag.to&&index>=drag.to&&index<drag.index?drag.height+drag.gap:0;
    return <div role={table?'row':undefined} className={'sortable-row mount-row '+(drag?.index===index?'drag-placeholder':'')} data-sort-index={index} key={itemKey?.(item,index)??index} style={{transform:`translateY(${shift}px)`}}>
      <div className="sort-handle-cell" role={table?'cell':undefined}><button className="drag-handle" aria-label={tt`排序 ${label}.${index}`} title={t("拖动排序；也可用上下方向键调整")} disabled={items.length<2} onPointerDown={e=>start(e,index)} onKeyDown={e=>{if(active.current)return;const to=e.key==='ArrowUp'?index-1:e.key==='ArrowDown'?index+1:-1;if(to>=0&&to<items.length){e.preventDefault();reorder(index,to);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-sort-index="${to}"] .drag-handle`)?.focus());}}}><Icon name="grip"/></button></div>
      <div className="sortable-content">{renderItem(item,index)}</div>
    </div>;
  })}</div><span className="sr-only" aria-live="polite">{announcement===null?'':announcement==='cancel'?t('已取消排序'):tt`已移动到第 ${announcement} 项`}</span>
  {drag&&createPortal(<div className={'sort-overlay sortable-row '+(table?'pipeline-drag':'')} aria-hidden="true" style={{position:'fixed',left:drag.left,top:drag.top,width:drag.width,height:drag.height}}><span className="drag-handle"><Icon name="grip"/></span><div className="sortable-content">{renderItem(items[drag.index],drag.index)}</div></div>,root.current?.closest('dialog[open]')||document.body)}</>;
}
