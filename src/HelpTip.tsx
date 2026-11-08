import {useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import Icon from './Icon';

export default function HelpTip({label,children,icon='help'}:{label:string;children:ReactNode;icon?:string}){
  const id=useId(),button=useRef<HTMLButtonElement>(null),tip=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:8,top:8});
  useLayoutEffect(()=>{
    if(!open||!button.current||!tip.current)return;
    const anchor=button.current.getBoundingClientRect(),box=tip.current.getBoundingClientRect();
    setPosition({left:Math.max(8,Math.min(anchor.left,innerWidth-box.width-8)),top:Math.max(8,Math.min(anchor.bottom+8+box.height<=innerHeight-8?anchor.bottom+8:anchor.top-box.height-8,innerHeight-box.height-8))});
  },[open,children]);
  useEffect(()=>{
    if(!open)return;
    const close=()=>setOpen(false);
    window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
    return()=>{window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};
  },[open]);
  return <><button ref={button} type="button" className="order-help" aria-label={label} aria-describedby={open?id:undefined}
    onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)}
    onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);}}}><Icon name={icon} size={14}/></button>
    {open&&createPortal(<div ref={tip} id={id} role="tooltip" className="order-tooltip" style={position}>{children}</div>,button.current?.closest('dialog[open]')||document.body)}</>;
}
