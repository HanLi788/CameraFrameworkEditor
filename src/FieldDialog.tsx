import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {t} from './i18n';
export default function FieldDialog({label,onConfirm,onCancel,children,error}:any){
 const host=useRef<HTMLDivElement>(null),previous=useRef(document.activeElement as HTMLElement|null);
 useEffect(()=>{host.current?.querySelector<HTMLElement>('input,textarea,select')?.focus();return()=>{if(previous.current?.isConnected)previous.current.focus({preventScroll:true});};},[]);
 return createPortal(<div className="modal-overlay field-dialog-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onCancel();}}><div ref={host} className="modal field-dialog" role="dialog" aria-modal="true" aria-label={label+' '+t('详情')} onKeyDownCapture={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onCancel();}
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();onConfirm();}
  if(e.key==='Tab'){const nodes=Array.from(host.current!.querySelectorAll<HTMLElement>('input,textarea,select,button:not(:disabled)'));const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><h2>{label}</h2><div className="field-dialog-content">{children}</div>{error&&<small className="range-error" role="alert">{error}</small>}<div className="modal-actions"><button onClick={onCancel}>{t('取消')}</button><button className="primary" onClick={onConfirm}>{t('确认')}</button></div></div></div>,document.body);
}
