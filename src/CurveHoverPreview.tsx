import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {t} from './i18n';
import CurveEditor from './CurveEditor';
import Icon from './Icon';

export default function CurveHoverPreview({anchor,data,name,id}:any){
  const host=useRef<HTMLDivElement>(null),[position,setPosition]=useState({left:8,top:8});
  useLayoutEffect(()=>{const a=anchor.getBoundingClientRect(),b=host.current!.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(a.left,innerWidth-b.width-8)),top:Math.max(8,Math.min(a.bottom+8+b.height<innerHeight?a.bottom+8:a.top-b.height-8,innerHeight-b.height-8))});},[anchor,data]);
  return createPortal(<div ref={host} id={id} role="tooltip" aria-label={t('曲线只读预览')} className="curve-hover-preview" style={position}><div className="curve-hover-heading"><Icon name="lock" size={14}/><strong>{name}</strong><span>{data.ParentType}</span></div><CurveEditor compact readOnly data={data}/></div>,anchor.closest('dialog[open]')||document.body);
}
