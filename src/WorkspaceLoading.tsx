import {useEffect,useRef} from 'react';
import {t} from './i18n';
import Icon from './Icon';
import './workspaceLoading.css';

export default function WorkspaceLoading(){
 const panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;panel.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 return <div className="workspace-loading" ref={panel} tabIndex={-1} role="status" aria-live="polite" aria-busy="true" aria-label={t('正在加载工作区…')} onKeyDown={event=>{if(event.key==='Tab')event.preventDefault();}}>
  <div className="workspace-loading-panel">
   <div className="workspace-loading-title"><Icon name="camera" size={24}/><h1>{t('正在加载工作区…')}</h1></div>
   <div className="workspace-loading-progress" role="progressbar" aria-label={t('加载进度')}><span/></div>
  </div>
 </div>;
}
