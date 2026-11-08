import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {t} from './i18n';
import {IconButton} from './Icon';

export default function CellPanel({anchor,title,onClose,children}:any){
  const host=useRef<HTMLDivElement>(null),pending=useRef<Promise<void>|null>(null),[error,setError]=useState(''),[position,setPosition]=useState({left:8,top:8});
  const close=(restoreFocus=false)=>{
    if(pending.current)return;
    const jobs:Promise<unknown>[]=[];
    host.current?.querySelectorAll('[data-range-interval]').forEach(el=>el.dispatchEvent(new CustomEvent('commit-range',{detail:jobs})));
    pending.current=Promise.all(jobs).then(()=>{onClose();if(restoreFocus)anchor.focus({preventScroll:true});}).catch(e=>setError(e.message)).finally(()=>{pending.current=null;});
  };
  useLayoutEffect(()=>{const a=anchor.getBoundingClientRect(),b=host.current!.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(a.left,innerWidth-b.width-8)),top:Math.max(8,Math.min(a.bottom+6+b.height<innerHeight?a.bottom+6:a.top-b.height-6,innerHeight-b.height-8))});},[anchor]);
  useEffect(()=>{host.current?.querySelector<HTMLElement>('input,select,button')?.focus();const outside=(e:PointerEvent)=>{if(!host.current?.contains(e.target as Node)&&!anchor.contains(e.target as Node))close();};const resize=()=>close();window.addEventListener('pointerdown',outside);window.addEventListener('resize',resize);return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize);};},[anchor,onClose]);
  return createPortal(<div ref={host} role="dialog" aria-label={title} className="cell-panel" style={position} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}}}><div className="cell-panel-heading"><strong>{title}</strong><IconButton icon="close" label={t('关闭参数')} onClick={()=>close(true)}/></div>{children}{error&&<small role="alert" className="range-error">{error}</small>}</div>,anchor.closest('dialog[open]')||document.body);
}
